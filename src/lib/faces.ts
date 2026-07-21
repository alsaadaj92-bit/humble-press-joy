// Local face detection & recognition using MediaPipe Tasks Vision.
// - FaceDetector (BlazeFace short-range) finds face bounding boxes.
// - ImageEmbedder (MobileNet V3 small) produces a 1024-D L2-normalized
//   embedding per cropped face, used for identity clustering.
//
// All models are lazy-loaded from Google's public model store and cached by
// the browser HTTP cache. Descriptors and boxes stay in IndexedDB — nothing
// is sent out. Works fully offline once cached (APK-friendly).
import {
  FilesetResolver,
  FaceDetector,
  ImageEmbedder,
  type ImageEmbedderResult,
} from "@mediapipe/tasks-vision";
import { photoDb, type FaceRow, type PersonRow } from "./photoDb";
import { clusterFaces, type FaceLike, type Cluster } from "./faceCluster";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const EMBEDDER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite";

// Kept exported so existing imports in preloadModels/settings keep working.
export const FACE_MODEL_URL = WASM_ROOT;

let detector: FaceDetector | null = null;
let embedder: ImageEmbedder | null = null;
let loaded: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    [detector, embedder] = await Promise.all([
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      }),
      ImageEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: EMBEDDER_MODEL },
        runningMode: "IMAGE",
        l2Normalize: true,
        quantize: false,
      }),
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

function cropToCanvas(
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  // Expand crop 20% for context — improves embedding stability.
  const pad = 0.2;
  const px = Math.max(0, x - w * pad);
  const py = Math.max(0, y - h * pad);
  const pw = Math.min(img.naturalWidth - px, w * (1 + pad * 2));
  const ph = Math.min(img.naturalHeight - py, h * (1 + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pw));
  canvas.height = Math.max(1, Math.round(ph));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, px, py, pw, ph, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function extractEmbedding(result: ImageEmbedderResult): number[] {
  const e = result.embeddings?.[0];
  if (!e) return [];
  // floatEmbedding is a number[] when quantize:false.
  return Array.from(e.floatEmbedding ?? []);
}

export async function detectFacesInImage(
  assetId: string,
  url: string,
): Promise<FaceRow[]> {
  await loadFaceModels();
  if (!detector || !embedder) return [];
  const img = await imageFromUrl(url);
  const det = detector.detect(img);
  const now = Date.now();
  const rows: FaceRow[] = [];
  for (let i = 0; i < det.detections.length; i++) {
    const d = det.detections[i];
    const bb = d.boundingBox;
    if (!bb) continue;
    const crop = cropToCanvas(img, bb.originX, bb.originY, bb.width, bb.height);
    const emb = extractEmbedding(embedder.embed(crop));
    if (!emb.length) continue;
    rows.push({
      id: `${assetId}:${i}`,
      assetId,
      descriptor: emb,
      box: { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height },
      detectedAt: now,
    });
  }
  return rows;
}

export async function saveDetectedFaces(rows: FaceRow[]): Promise<void> {
  if (!rows.length) return;
  await photoDb.faces.bulkPut(rows);
}

/**
 * Re-cluster all stored faces and update person assignments.
 * MobileNet L2-normalized embeddings need a wider threshold than face-api's
 * 128-D descriptors — ~0.95 euclidean works well as a starting point.
 */
export async function rebuildPersons(threshold = 0.95): Promise<Cluster[]> {
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
