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
import { faceModelId, getFaceSettings, type FaceProcessingMode } from "./faceSettings";
import { logDiag } from "./diagnostics";

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
let loadedMode: FaceProcessingMode | null = null;

export type FaceModelStage = "wasm" | "detector" | "embedder" | "ready";
export interface FaceModelStatus {
  status: "idle" | "loading" | "ready" | "error";
  stage?: FaceModelStage;
  progress: number;
  mode?: FaceProcessingMode;
  message?: string;
}

const modelListeners = new Set<(s: FaceModelStatus) => void>();
let modelStatus: FaceModelStatus = { status: "idle", progress: 0 };

function emitModelStatus(patch: Partial<FaceModelStatus>) {
  modelStatus = { ...modelStatus, ...patch };
  for (const l of modelListeners) l({ ...modelStatus });
}

export function subscribeFaceModelStatus(cb: (s: FaceModelStatus) => void) {
  modelListeners.add(cb);
  cb({ ...modelStatus });
  return () => modelListeners.delete(cb);
}

export async function resetFaceModels() {
  detector?.close?.();
  embedder?.close?.();
  detector = null;
  embedder = null;
  loaded = null;
  loadedMode = null;
  emitModelStatus({ status: "idle", stage: undefined, progress: 0, message: undefined });
}

export async function loadFaceModels(): Promise<void> {
  const settings = await getFaceSettings();
  if (loaded && loadedMode === settings.mode) return loaded;
  if (loadedMode && loadedMode !== settings.mode) await resetFaceModels();
  loaded = (async () => {
    const preferredDelegate = settings.mode === "fast" ? "GPU" : "CPU";
    loadedMode = settings.mode;
    emitModelStatus({ status: "loading", stage: "wasm", progress: 0.12, mode: settings.mode, message: undefined });
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const create = async (delegate: "CPU" | "GPU") => {
      emitModelStatus({ status: "loading", stage: "detector", progress: 0.36, mode: settings.mode });
      const nextDetector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL, delegate },
        runningMode: "IMAGE",
        minDetectionConfidence: settings.mode === "accurate" ? 0.62 : 0.48,
      });
      emitModelStatus({ status: "loading", stage: "embedder", progress: 0.72, mode: settings.mode });
      const nextEmbedder = await ImageEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: EMBEDDER_MODEL, delegate },
        runningMode: "IMAGE",
        l2Normalize: true,
        quantize: false,
      });
      return [nextDetector, nextEmbedder] as const;
    };

    try {
      [detector, embedder] = await create(preferredDelegate);
      logDiag("info", "faces", `models ready (${loadedMode})`, { delegate: preferredDelegate });
    } catch (err) {
      logDiag("warn", "faces", `GPU delegate failed, falling back to CPU`, err);
      if (preferredDelegate !== "GPU") throw err;
      // Android WebViews vary widely. Fast mode tries GPU first, then falls
      // back to CPU automatically while keeping the user's mode unchanged.
      [detector, embedder] = await create("CPU");
    }
    emitModelStatus({ status: "ready", stage: "ready", progress: 1, mode: settings.mode });
  })().catch((err) => {
    loaded = null;
    loadedMode = null;
    logDiag("error", "faces", "model load failed", err);
    emitModelStatus({ status: "error", progress: 0, message: err instanceof Error ? err.message : String(err) });
    throw err;
  });
  return loaded;
}

function cropToCanvas(
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
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
  return Array.from(e.floatEmbedding ?? []);
}

async function decodeImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  img.src = src;
  // Use decode() so MediaPipe never re-fetches; if unsupported, fall back to onload.
  if (typeof img.decode === "function") {
    await img.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });
  }
  return img;
}

async function loadImageForFaces(
  assetId: string,
  url: string,
): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  // Prefer the Dexie-stored Blob: it's local, CORS-free, and stable across
  // MediaPipe's internal re-reads. Fall back to the provided URL only if the
  // asset isn't cached locally (e.g. remote-only providers).
  let objectUrl: string | null = null;
  try {
    const asset = await photoDb.assets.get(assetId);
    if (asset?.blob) {
      objectUrl = URL.createObjectURL(asset.blob);
      const img = await decodeImage(objectUrl);
      return {
        img,
        cleanup: () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        },
      };
    }
  } catch (err) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    logDiag("warn", "faces", "dexie blob load failed, fetching url", err);
  }

  // Fallback: fetch the URL ourselves into a Blob so MediaPipe's internal
  // image reads never hit a cross-origin src or a stale data: URI.
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
    const img = await decodeImage(objectUrl);
    return {
      img,
      cleanup: () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      },
    };
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    // Last resort: decode directly from the source URL.
    const img = await decodeImage(url);
    return { img, cleanup: () => {} };
  }
}

export async function detectFacesInImage(
  assetId: string,
  url: string,
  sourceStamp?: number,
): Promise<FaceRow[]> {
  const started = performance.now();
  const settings = await getFaceSettings();
  await loadFaceModels();
  if (!detector || !embedder) return [];
  const { img, cleanup } = await loadImageForFaces(assetId, url);
  try {
    const det = detector.detect(img);
    const now = Date.now();
    const modelId = faceModelId(settings.mode);
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
        modelId,
        sourceStamp,
      });
    }
    const durationMs = Math.round(performance.now() - started);
    for (const row of rows) row.durationMs = durationMs;
    await markFaceScanned(assetId, { modelId, sourceStamp, durationMs, faces: rows.length });
    return rows;
  } finally {
    cleanup();
  }
}

export async function saveDetectedFaces(rows: FaceRow[]): Promise<void> {
  if (!rows.length) return;
  await photoDb.faces.bulkPut(rows);
}

export interface FaceScanMeta {
  modelId: string;
  sourceStamp?: number;
  durationMs: number;
  faces: number;
  scannedAt: number;
}

const scanMetaKey = (assetId: string) => `faceScan:${assetId}`;

async function markFaceScanned(assetId: string, meta: Omit<FaceScanMeta, "scannedAt">) {
  await photoDb.kv.put({
    key: scanMetaKey(assetId),
    value: JSON.stringify({ ...meta, scannedAt: Date.now() } satisfies FaceScanMeta),
  });
}

export async function getFaceScanMeta(assetId: string): Promise<FaceScanMeta | null> {
  const row = await photoDb.kv.get(scanMetaKey(assetId));
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as FaceScanMeta;
  } catch {
    return null;
  }
}

export async function shouldScanFaces(assetId: string, sourceStamp?: number): Promise<boolean> {
  const settings = await getFaceSettings();
  const expectedModelId = faceModelId(settings.mode);
  const meta = await getFaceScanMeta(assetId);
  if (!meta) return true;
  if (meta.modelId !== expectedModelId) return true;
  if (sourceStamp !== undefined && meta.sourceStamp !== sourceStamp) return true;
  return false;
}

export async function replaceDetectedFaces(assetId: string, rows: FaceRow[]): Promise<void> {
  await photoDb.transaction("rw", photoDb.faces, async () => {
    await photoDb.faces.where("assetId").equals(assetId).delete();
    if (rows.length) await photoDb.faces.bulkPut(rows);
  });
}

export async function faceScanStats() {
  const rows = (await photoDb.kv.toArray()).filter((r) => r.key.startsWith("faceScan:"));
  const durations: number[] = [];
  let scanned = 0;
  let faces = 0;
  for (const row of rows) {
    try {
      const meta = JSON.parse(row.value) as FaceScanMeta;
      scanned++;
      faces += meta.faces || 0;
      if (meta.durationMs) durations.push(meta.durationMs);
    } catch { /* ignore malformed rows */ }
  }
  const averageMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  return { scanned, faces, averageMs };
}

/**
 * Re-cluster all stored faces and update person assignments.
 * MobileNet L2-normalized embeddings need a wider threshold than face-api's
 * 128-D descriptors — ~0.95 euclidean works well as a starting point.
 */
export async function rebuildPersons(threshold?: number): Promise<Cluster[]> {
  const settings = await getFaceSettings();
  const effectiveThreshold = threshold ?? settings.clusterThreshold;
  const faces = await photoDb.faces.toArray();
  const like: FaceLike[] = faces.map((f) => ({
    id: f.id,
    assetId: f.assetId,
    descriptor: f.descriptor,
  }));
  const clusters = clusterFaces(like, effectiveThreshold);
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
