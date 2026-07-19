// Local face detection & recognition using @vladmandic/face-api (TFJS).
// Models are lazy-loaded from a public CDN and cached by the browser.
// Detected face descriptors + boxes stay in IndexedDB — nothing is sent out.
import * as faceapi from "@vladmandic/face-api";
import { photoDb, type FaceRow, type PersonRow } from "./photoDb";
import { clusterFaces, type FaceLike, type Cluster } from "./faceCluster";

// jsDelivr mirror of the official model weights bundled with the library.
export const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

let loaded: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]);
  })().catch((err) => {
    loaded = null;
    throw err;
  });
  return loaded;
}

async function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

export async function detectFacesInImage(
  assetId: string,
  url: string,
): Promise<FaceRow[]> {
  await loadFaceModels();
  const img = await imageFromUrl(url);
  const results = await faceapi
    .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptors();
  const now = Date.now();
  return results.map((r, i) => ({
    id: `${assetId}:${i}`,
    assetId,
    descriptor: Array.from(r.descriptor),
    box: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    },
    detectedAt: now,
  }));
}

export async function saveDetectedFaces(rows: FaceRow[]): Promise<void> {
  if (!rows.length) return;
  await photoDb.faces.bulkPut(rows);
}

/** Re-cluster all stored faces and update person assignments. */
export async function rebuildPersons(threshold = 0.55): Promise<Cluster[]> {
  const faces = await photoDb.faces.toArray();
  const like: FaceLike[] = faces.map((f) => ({
    id: f.id,
    assetId: f.assetId,
    descriptor: f.descriptor,
  }));
  const clusters = clusterFaces(like, threshold);
  const now = Date.now();

  const existing = new Map<string, PersonRow>();
  for (const p of await photoDb.persons.toArray()) existing.set(p.id, p);

  const persons: PersonRow[] = clusters.map((c) => {
    const prev = existing.get(c.id);
    return {
      id: c.id,
      name: prev?.name,
      coverFaceId: prev?.coverFaceId ?? c.faceIds[0],
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      hidden: prev?.hidden ?? false,
    };
  });

  await photoDb.transaction("rw", photoDb.faces, photoDb.persons, async () => {
    await photoDb.persons.clear();
    await photoDb.persons.bulkPut(persons);
    // Update person assignments
    const updates: FaceRow[] = [];
    const byId = new Map(faces.map((f) => [f.id, f]));
    for (const c of clusters) {
      for (const fid of c.faceIds) {
        const f = byId.get(fid);
        if (f && f.personId !== c.id) updates.push({ ...f, personId: c.id });
      }
    }
    if (updates.length) await photoDb.faces.bulkPut(updates);
  });

  return clusters;
}

export async function renamePerson(id: string, name: string): Promise<void> {
  await photoDb.persons.update(id, { name: name.trim() || undefined, updatedAt: Date.now() });
}

export async function hidePerson(id: string, hidden: boolean): Promise<void> {
  await photoDb.persons.update(id, { hidden, updatedAt: Date.now() });
}
