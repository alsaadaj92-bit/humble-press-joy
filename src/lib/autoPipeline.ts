/**
 * AutoPipeline — silent background processing that runs after every successful
 * upload (and can be triggered manually for existing assets). Each task is
 * independent and idempotent: running the pipeline twice on the same asset is
 * safe and cheap. All work happens locally in the browser.
 *
 * Tasks (in order, cheap → expensive):
 *   1. duplicate hash cache (metadata-only, instant)
 *   2. OCR (Tesseract wasm)
 *   3. CLIP image embedding
 *   4. Face detection + descriptor
 *
 * The pipeline is opt-in: the first-run consent dialog stores a boolean in
 * `photoDb.kv` under `autoPipelineConsent`. When disabled, `runFor()` is a
 * no-op so users retain full control.
 */
import { photoDb, type MediaAsset } from "@/lib/photoDb";
import { resolveAssetUrl } from "@/lib/providers";
import { ocrImage, saveOcr } from "@/lib/ocr";
import { embedImageFromUrl, putEmbedding, getEmbedding } from "@/lib/semantic";
import { detectFacesInImage, replaceDetectedFaces, shouldScanFaces } from "@/lib/faces";
import { faceSourceStamp } from "@/lib/faceSettings";

export const CONSENT_KEY = "autoPipelineConsent";
export const TASKS_KEY = "autoPipelineTasks";

export interface AutoPipelineTasks {
  ocr: boolean;
  embed: boolean;
  faces: boolean;
}

export const DEFAULT_TASKS: AutoPipelineTasks = {
  ocr: true,
  embed: true,
  faces: true,
};

export type ConsentState = "unset" | "granted" | "denied";

export async function getConsent(): Promise<ConsentState> {
  const raw = await photoDb.kv.get(CONSENT_KEY);
  if (!raw?.value) return "unset";
  return raw.value === "granted" ? "granted" : "denied";
}

export async function setConsent(state: "granted" | "denied") {
  await photoDb.kv.put({ key: CONSENT_KEY, value: state });
}

export async function getTasks(): Promise<AutoPipelineTasks> {
  const raw = await photoDb.kv.get(TASKS_KEY);
  if (!raw?.value) return DEFAULT_TASKS;
  try {
    return { ...DEFAULT_TASKS, ...JSON.parse(raw.value) };
  } catch {
    return DEFAULT_TASKS;
  }
}

export async function setTasks(patch: Partial<AutoPipelineTasks>) {
  const cur = await getTasks();
  const next = { ...cur, ...patch };
  await photoDb.kv.put({ key: TASKS_KEY, value: JSON.stringify(next) });
  return next;
}

// -- Live status (in-memory; UI subscribes) --------------------------------
export interface PipelineStatus {
  running: boolean;
  currentAssetId?: string;
  currentTask?: string;
  processed: number;
  failed: number;
  queued: number;
}

const listeners = new Set<(s: PipelineStatus) => void>();
const status: PipelineStatus = {
  running: false,
  processed: 0,
  failed: 0,
  queued: 0,
};

function emit() {
  const snap = { ...status };
  for (const l of listeners) l(snap);
}
export function subscribeStatus(cb: (s: PipelineStatus) => void) {
  listeners.add(cb);
  cb({ ...status });
  return () => listeners.delete(cb);
}

// -- Queue -----------------------------------------------------------------
const queue: string[] = [];
const enqueued = new Set<string>();
let loopRunning = false;

/** Public entry — call after a syncJob completes with a fresh assetId. */
export async function enqueue(assetId: string) {
  if (enqueued.has(assetId)) return;
  const consent = await getConsent();
  if (consent !== "granted") return;
  enqueued.add(assetId);
  queue.push(assetId);
  status.queued = queue.length;
  emit();
  void drain();
}

/** Force-run for existing assets (e.g. a "process all" button). */
export async function enqueueMany(ids: string[]) {
  for (const id of ids) await enqueue(id);
}

async function drain() {
  if (loopRunning) return;
  loopRunning = true;
  status.running = true;
  emit();
  try {
    while (queue.length) {
      const id = queue.shift()!;
      status.queued = queue.length;
      status.currentAssetId = id;
      emit();
      try {
        await runFor(id);
        status.processed++;
      } catch (e) {
        status.failed++;
        console.warn("[autoPipeline] failed", id, e);
      }
      enqueued.delete(id);
    }
  } finally {
    loopRunning = false;
    status.running = false;
    status.currentAssetId = undefined;
    status.currentTask = undefined;
    emit();
  }
}

async function runFor(assetId: string) {
  const asset = await photoDb.assets.get(assetId);
  if (!asset) return;
  const tasks = await getTasks();

  // Videos: skip OCR/CLIP/faces (would need frame extraction — future work).
  const isVideo = asset.kind === "video" || asset.mime.startsWith("video/");
  if (isVideo) return;
  // E2EE ciphertext: skip — we cannot process encrypted bytes.
  if (asset.encryption) return;

  const cfg = await photoDb.providers.get(asset.provider);
  let url: string;
  try {
    url = await resolveAssetUrl(asset, cfg);
  } catch {
    return; // provider offline — try later
  }

  if (tasks.ocr) {
    status.currentTask = "OCR";
    emit();
    try {
      const existing = await photoDb.ocr.get(assetId);
      if (!existing) {
        const res = await ocrImage(url);
        if (res.text.trim().length) await saveOcr(assetId, res);
      }
    } catch (e) {
      console.warn("[autoPipeline:ocr]", e);
    }
  }

  if (tasks.embed) {
    status.currentTask = "بحث ذكي";
    emit();
    try {
      if (!(await getEmbedding(assetId))) {
        const vec = await embedImageFromUrl(url);
        await putEmbedding(assetId, vec);
      }
    } catch (e) {
      console.warn("[autoPipeline:embed]", e);
    }
  }

  if (tasks.faces) {
    status.currentTask = "الوجوه";
    emit();
    try {
      const stamp = faceSourceStamp(asset);
      if (await shouldScanFaces(assetId, stamp)) {
        const rows = await detectFacesInImage(assetId, url, stamp);
        await replaceDetectedFaces(assetId, rows);
      }
    } catch (e) {
      console.warn("[autoPipeline:faces]", e);
    }
  }
}

/** Kickstart processing for any existing asset that never went through. */
export async function backfillMissing(limit = 50): Promise<number> {
  const consent = await getConsent();
  if (consent !== "granted") return 0;
  const assets: MediaAsset[] = await photoDb.assets
    .orderBy("createdAt")
    .reverse()
    .limit(limit)
    .toArray();
  const tasks = await getTasks();
  let queued = 0;
  for (const a of assets) {
    if (a.encryption) continue;
    if (a.kind === "video" || a.mime.startsWith("video/")) continue;
    const [hasOcr, hasEmb, hasFace] = await Promise.all([
      tasks.ocr ? photoDb.ocr.get(a.id).then(Boolean) : Promise.resolve(true),
      tasks.embed ? getEmbedding(a.id).then(Boolean) : Promise.resolve(true),
      tasks.faces
        ? shouldScanFaces(a.id, faceSourceStamp(a)).then((needs) => !needs)
        : Promise.resolve(true),
    ]);
    if (!hasOcr || !hasEmb || !hasFace) {
      await enqueue(a.id);
      queued++;
    }
  }
  return queued;
}
