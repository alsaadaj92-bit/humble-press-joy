/**
 * Chunked / resumable uploader for the LocalGallery Pro companion server.
 *
 * Persists per-file uploadId in Dexie KV so uploads survive reloads and
 * network drops. All bytes still travel only to the user's own LAN server.
 */
import { photoDb } from "@/lib/photoDb";
import { DEFAULT_CHUNK_SIZE, planChunks, remainingChunks } from "@/lib/chunker";

function normalize(base: string) {
  return base.replace(/\/+$/, "");
}

const KV_PREFIX = "chunked-upload:";

interface Persisted {
  uploadId: string;
  baseUrl: string;
  name: string;
  size: number;
  mime: string;
  chunkSize: number;
  createdAt: number;
}

async function loadState(jobId: string): Promise<Persisted | null> {
  const raw = await photoDb.kv.get(KV_PREFIX + jobId);
  if (!raw?.value) return null;
  try { return JSON.parse(raw.value) as Persisted; } catch { return null; }
}
async function saveState(jobId: string, s: Persisted) {
  await photoDb.kv.put({ key: KV_PREFIX + jobId, value: JSON.stringify(s) });
}
async function clearState(jobId: string) {
  await photoDb.kv.delete(KV_PREFIX + jobId);
}

export interface LsChunkedResult {
  url: string;
  path: string;
}

export interface LsChunkedOptions {
  jobId: string;
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const text = await r.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!r.ok) {
    const msg = (body && typeof body === "object" && "error" in body)
      ? String((body as { error: unknown }).error)
      : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export async function localServerUploadChunked(
  baseUrl: string,
  file: File,
  opts: LsChunkedOptions,
): Promise<LsChunkedResult> {
  const base = normalize(baseUrl);
  const { jobId, onProgress, signal } = opts;

  // Try to resume a previous session for this job.
  let state = await loadState(jobId);
  let received = 0;

  if (state && state.baseUrl === base && state.size === file.size && state.name === file.name) {
    try {
      const st = await jsonFetch<{ received: number; size: number }>(
        `${base}/upload/status/${state.uploadId}`,
      );
      received = st.received;
    } catch {
      // server forgot this upload; start fresh
      state = null;
    }
  } else {
    state = null;
  }

  if (!state) {
    const init = await jsonFetch<{ uploadId: string; chunkSize?: number }>(
      `${base}/upload/init`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, mime: file.type }),
        signal,
      },
    );
    state = {
      uploadId: init.uploadId,
      baseUrl: base,
      name: file.name,
      size: file.size,
      mime: file.type,
      chunkSize: init.chunkSize && init.chunkSize > 0 ? init.chunkSize : DEFAULT_CHUNK_SIZE,
      createdAt: Date.now(),
    };
    await saveState(jobId, state);
    received = 0;
  }

  onProgress?.(received, file.size);

  // Empty file — just complete.
  if (file.size === 0) {
    const done = await jsonFetch<LsChunkedResult>(`${base}/upload/complete/${state.uploadId}`, {
      method: "POST",
      signal,
    });
    await clearState(jobId);
    const url = /^https?:\/\//i.test(done.url) ? done.url : `${base}${done.url}`;
    return { url, path: done.path };
  }

  const chunks = remainingChunks(file.size, received, state.chunkSize);
  for (const c of chunks) {
    if (signal?.aborted) throw new Error("aborted");
    const slice = file.slice(c.offset, c.end);
    // Retry loop for transient failures.
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const r = await jsonFetch<{ received: number }>(
          `${base}/upload/chunk/${state.uploadId}?offset=${c.offset}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: slice,
            signal,
          },
        );
        received = r.received;
        onProgress?.(received, file.size);
        break;
      } catch (e) {
        attempt++;
        if (attempt >= 4) throw e;
        await new Promise((res) => setTimeout(res, 400 * attempt));
      }
    }
  }

  const done = await jsonFetch<LsChunkedResult>(`${base}/upload/complete/${state.uploadId}`, {
    method: "POST",
    signal,
  });
  await clearState(jobId);
  const url = /^https?:\/\//i.test(done.url) ? done.url : `${base}${done.url}`;
  return { url, path: done.path };
}

/** Abort + clean up state for a job that is being deleted. */
export async function localServerAbort(baseUrl: string, jobId: string) {
  const state = await loadState(jobId);
  if (!state) return;
  try {
    await fetch(`${normalize(baseUrl)}/upload/${state.uploadId}`, { method: "DELETE" });
  } catch { /* ignore */ }
  await clearState(jobId);
}

/** Feature-detects the chunked API by probing /health. */
export async function localServerSupportsChunked(baseUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${normalize(baseUrl)}/health`);
    if (!r.ok) return false;
    const j = (await r.json()) as { features?: string[] };
    return Array.isArray(j.features) && j.features.includes("chunked");
  } catch {
    return false;
  }
}

// Ensure planChunks stays reachable for consumers that want to preview totals.
export { planChunks };
