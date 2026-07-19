// Local semantic search using CLIP via transformers.js.
// Model weights are fetched once from the HuggingFace CDN and cached in the
// browser (IndexedDB / Cache Storage). *No user photos or queries ever leave
// the device* — inference runs 100% locally in WebAssembly / WebGPU.
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";
import { photoDb } from "./photoDb";

export const CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";

// Make sure transformers.js uses the remote model cache (default), not local.
env.allowLocalModels = false;

type ClipBundle = {
  processor: any;
  tokenizer: any;
  vision: any;
  text: any;
};

let bundlePromise: Promise<ClipBundle> | null = null;

export function loadClip(
  onProgress?: (p: { status: string; progress?: number; file?: string }) => void,
): Promise<ClipBundle> {
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    const opts: any = { progress_callback: onProgress };
    const [processor, tokenizer, vision, text] = await Promise.all([
      AutoProcessor.from_pretrained(CLIP_MODEL_ID, opts),
      AutoTokenizer.from_pretrained(CLIP_MODEL_ID, opts),
      CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, opts),
      CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, opts),
    ]);
    return { processor, tokenizer, vision, text };
  })();
  return bundlePromise;
}

// -------- Math helpers (pure, unit-tested) --------------------------------
export function normalize(v: number[] | Float32Array): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const n = Math.sqrt(sum) || 1;
  const out = new Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function topK<T>(
  items: T[],
  scoreOf: (x: T) => number,
  k: number,
): { item: T; score: number }[] {
  const scored = items.map((item) => ({ item, score: scoreOf(item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// -------- Embedding functions ---------------------------------------------
export async function embedText(query: string): Promise<number[]> {
  const { tokenizer, text } = await loadClip();
  const inputs = tokenizer([query], { padding: true, truncation: true });
  const out = await text(inputs);
  const vec = Array.from(out.text_embeds.data as Float32Array);
  return normalize(vec);
}

export async function embedImageFromUrl(url: string): Promise<number[]> {
  const { processor, vision } = await loadClip();
  const image = await RawImage.read(url);
  const inputs = await processor(image);
  const out = await vision(inputs);
  const vec = Array.from(out.image_embeds.data as Float32Array);
  return normalize(vec);
}

// -------- Persistent embedding cache --------------------------------------
export interface EmbeddingRecord {
  id: string;
  vec: number[];
  dim: number;
  modelId: string;
  updatedAt: number;
}

export async function getEmbedding(id: string): Promise<EmbeddingRecord | undefined> {
  return photoDb.table("embeddings").get(id);
}

export async function putEmbedding(id: string, vec: number[]): Promise<void> {
  await photoDb.table("embeddings").put({
    id,
    vec,
    dim: vec.length,
    modelId: CLIP_MODEL_ID,
    updatedAt: Date.now(),
  } satisfies EmbeddingRecord);
}

export async function countEmbeddings(): Promise<number> {
  return photoDb.table("embeddings").count();
}

export async function allEmbeddings(): Promise<EmbeddingRecord[]> {
  return photoDb.table("embeddings").toArray();
}

export async function clearEmbeddings(): Promise<void> {
  await photoDb.table("embeddings").clear();
}
