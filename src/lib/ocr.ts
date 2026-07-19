// Local OCR via tesseract.js.
// All recognition runs inside the browser via a WebAssembly worker.
// The trained language data (ara+eng) is fetched once from a CDN and cached
// in IndexedDB by tesseract.js itself — no user photo ever leaves the device.

import { createWorker, type Worker } from "tesseract.js";
import { photoDb, type OcrRow } from "./photoDb";

const LANG = "ara+eng";
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker(LANG);
      return w;
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
  }
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function ocrImage(source: string | Blob | HTMLImageElement | HTMLCanvasElement): Promise<OcrResult> {
  const w = await getWorker();
  const { data } = await w.recognize(source as never);
  return {
    text: (data.text ?? "").trim(),
    confidence: Math.round(data.confidence ?? 0),
  };
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
