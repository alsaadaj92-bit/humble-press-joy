/**
 * Local image compression — resizes and re-encodes to WebP/JPEG entirely in
 * the browser (Canvas + Blob). Never uploads or leaves the device.
 * Videos and already-small files pass through unchanged.
 */

export type CompressFormat = "webp" | "jpeg" | "original";

export interface CompressSettings {
  enabled: boolean;
  format: CompressFormat;   // "original" = keep source mime
  quality: number;          // 0.1..1
  maxDimension: number;     // longest edge in px, 0 = no resize
  /** Skip compression if the source is smaller than this (KB). */
  skipUnderKb: number;
}

export const DEFAULT_COMPRESS: CompressSettings = {
  enabled: false,
  format: "webp",
  quality: 0.82,
  maxDimension: 2560,
  skipUnderKb: 300,
};

const IMG_MIMES = /^image\/(jpeg|png|webp|bmp|tiff)$/i;

export function shouldCompress(file: File, s: CompressSettings): boolean {
  if (!s.enabled) return false;
  if (!IMG_MIMES.test(file.type)) return false;
  if (file.size <= s.skipUnderKb * 1024) return false;
  return true;
}

async function decodeImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("تعذّر قراءة الصورة"));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after the caller draws to canvas — do it on next tick.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function targetSize(w: number, h: number, max: number) {
  if (!max || (w <= max && h <= max)) return { w, h };
  const ratio = w >= h ? max / w : max / h;
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

export interface CompressResult {
  file: File;
  changed: boolean;
  originalSize: number;
  ratio: number;
}

export async function compressImage(
  file: File,
  s: CompressSettings,
): Promise<CompressResult> {
  const original = { file, changed: false, originalSize: file.size, ratio: 1 };
  if (!shouldCompress(file, s)) return original;

  let img: HTMLImageElement;
  try {
    img = await decodeImage(file);
  } catch {
    return original;
  }

  const { w, h } = targetSize(img.naturalWidth, img.naturalHeight, s.maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);

  const outMime =
    s.format === "original" ? file.type : s.format === "jpeg" ? "image/jpeg" : "image/webp";

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outMime, s.quality),
  );
  if (!blob || blob.size >= file.size) return original;

  const ext = outMime === "image/webp" ? "webp" : outMime === "image/jpeg" ? "jpg" : file.name.split(".").pop();
  const base = file.name.replace(/\.[^.]+$/, "");
  const outFile = new File([blob], `${base}.${ext}`, {
    type: outMime,
    lastModified: file.lastModified,
  });
  return {
    file: outFile,
    changed: true,
    originalSize: file.size,
    ratio: blob.size / file.size,
  };
}
