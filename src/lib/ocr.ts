// Local OCR via tesseract.js.
// All recognition runs inside the browser via a WebAssembly worker.
// The trained language data (ara+eng) is fetched once from a CDN and cached
// in IndexedDB by tesseract.js itself — no user photo ever leaves the device.

import { createWorker, type Worker } from "tesseract.js";
import { photoDb, type OcrRow } from "./photoDb";
import { logAI, mark } from "./diagnostics";

const LANG = "ara+eng";
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const t = mark();
      logAI("ocr", "worker: create start", { lang: LANG });
      try {
        const w = await createWorker(LANG);
        logAI("ocr", "worker: ready", { lang: LANG, ms: t() });
        return w;
      } catch (err) {
        logAI("ocr", "worker: create failed", err, "error");
        workerPromise = null;
        throw err;
      }
    })();
  }
  return workerPromise;
}

/** Terminate the shared worker (frees ~30 MB). */
export async function disposeOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
    logAI("ocr", "worker: terminated");
  }
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function ocrImage(source: string | Blob | HTMLImageElement | HTMLCanvasElement): Promise<OcrResult> {
  const w = await getWorker();
  const t = mark();
  try {
    const { data } = await w.recognize(source as never);
    const text = (data.text ?? "").trim();
    const confidence = Math.round(data.confidence ?? 0);
    logAI("ocr", "recognize done", { ms: t(), chars: text.length, confidence });
    return { text, confidence };
  } catch (err) {
    logAI("ocr", "recognize failed", err, "error");
    throw err;
  }
}

export async function saveOcr(id: string, result: OcrResult): Promise<OcrRow> {
  const row: OcrRow = {
    id,
    text: result.text,
    lang: LANG,
    confidence: result.confidence,
    updatedAt: Date.now(),
  };
  await photoDb.ocr.put(row);
  return row;
}

export async function getOcr(id: string): Promise<OcrRow | undefined> {
  return photoDb.ocr.get(id);
}

export async function allOcr(): Promise<OcrRow[]> {
  return photoDb.ocr.toArray();
}

export async function deleteOcr(id: string) {
  await photoDb.ocr.delete(id);
}

/** Simple case-insensitive substring match with Arabic diacritics stripped. */
export function normalizeText(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "") // Arabic tashkeel
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesOcr(row: OcrRow | undefined, term: string): boolean {
  if (!row?.text) return false;
  return normalizeText(row.text).includes(normalizeText(term));
}
