// Pure, canvas-based image editing pipeline. No network, no external deps.
// Everything runs on the caller's device — an in-memory HTMLCanvasElement is
// drawn with the requested transforms/filters and exported as a Blob.

export interface EditAdjustments {
  brightness: number; // 0..2 (1 = original)
  contrast: number;   // 0..2
  saturate: number;   // 0..2
  sepia: number;      // 0..1
  grayscale: number;  // 0..1
  hueRotate: number;  // degrees (0..360)
  blur: number;       // px (0..10)
}

export const NEUTRAL_ADJUSTMENTS: EditAdjustments = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
  blur: 0,
};

export type FilterPreset =
  | "none"
  | "mono"
  | "sepia"
  | "vintage"
  | "cool"
  | "warm"
  | "vivid"
  | "fade";

export const FILTER_PRESETS: Record<FilterPreset, Partial<EditAdjustments>> = {
  none: {},
  mono: { grayscale: 1, contrast: 1.1 },
  sepia: { sepia: 1, contrast: 1.05, brightness: 1.02 },
  vintage: { sepia: 0.35, contrast: 0.9, brightness: 1.05, saturate: 0.85 },
  cool: { hueRotate: 200, saturate: 1.1 },
  warm: { hueRotate: 20, saturate: 1.15, brightness: 1.05 },
  vivid: { saturate: 1.4, contrast: 1.15 },
  fade: { contrast: 0.85, brightness: 1.08, saturate: 0.9 },
};

/** Merge a preset over neutral, then user overrides. */
export function resolveAdjustments(
  preset: FilterPreset,
  overrides: Partial<EditAdjustments>,
): EditAdjustments {
  return { ...NEUTRAL_ADJUSTMENTS, ...FILTER_PRESETS[preset], ...overrides };
}

export function toCssFilter(a: EditAdjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 1) parts.push(`brightness(${a.brightness})`);
  if (a.contrast !== 1) parts.push(`contrast(${a.contrast})`);
  if (a.saturate !== 1) parts.push(`saturate(${a.saturate})`);
  if (a.sepia > 0) parts.push(`sepia(${a.sepia})`);
  if (a.grayscale > 0) parts.push(`grayscale(${a.grayscale})`);
  if (a.hueRotate !== 0) parts.push(`hue-rotate(${a.hueRotate}deg)`);
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.length ? parts.join(" ") : "none";
}

export interface CropRect {
  /** Normalized 0..1 coordinates relative to the source image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditPipeline {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  crop?: CropRect;
  adjustments: EditAdjustments;
}

export const NEUTRAL_PIPELINE: EditPipeline = {
  rotate: 0,
  flipH: false,
  flipV: false,
  adjustments: { ...NEUTRAL_ADJUSTMENTS },
};

export function isNeutralPipeline(p: EditPipeline): boolean {
  if (p.rotate !== 0 || p.flipH || p.flipV) return false;
  if (p.crop) return false;
  const a = p.adjustments;
  return (
    a.brightness === 1 &&
    a.contrast === 1 &&
    a.saturate === 1 &&
    a.sepia === 0 &&
    a.grayscale === 0 &&
    a.hueRotate === 0 &&
    a.blur === 0
  );
}

export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر تحميل الصورة"));
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });
}

interface RenderOptions {
  mime?: string;
  quality?: number;
  maxSide?: number;
}

/**
 * Apply the full pipeline to a source image and return a Blob.
 * Pure — the caller decides where the output goes (download / upload / preview).
 */
export async function renderPipeline(
  source: HTMLImageElement | HTMLCanvasElement,
  pipeline: EditPipeline,
  opts: RenderOptions = {},
): Promise<Blob> {
  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;

  // 1) Crop in source coordinates.
  const crop = pipeline.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const cx = Math.max(0, Math.min(1, crop.x)) * srcW;
  const cy = Math.max(0, Math.min(1, crop.y)) * srcH;
  const cw = Math.max(1, Math.min(1 - crop.x, crop.width) * srcW);
  const ch = Math.max(1, Math.min(1 - crop.y, crop.height) * srcH);

  // 2) Rotation swaps output dimensions for 90/270.
  const rotated90 = pipeline.rotate === 90 || pipeline.rotate === 270;
  let outW = rotated90 ? ch : cw;
  let outH = rotated90 ? cw : ch;

  // 3) Optional downscale for export.
  if (opts.maxSide && Math.max(outW, outH) > opts.maxSide) {
    const scale = opts.maxSide / Math.max(outW, outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(outW));
  canvas.height = Math.max(1, Math.round(outH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D غير متاح");

  ctx.filter = toCssFilter(pipeline.adjustments);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((pipeline.rotate * Math.PI) / 180);
  ctx.scale(pipeline.flipH ? -1 : 1, pipeline.flipV ? -1 : 1);

  // After rotation the drawing box uses the un-rotated crop dimensions.
  const drawW = rotated90 ? canvas.height : canvas.width;
  const drawH = rotated90 ? canvas.width : canvas.height;
  ctx.drawImage(source, cx, cy, cw, ch, -drawW / 2, -drawH / 2, drawW, drawH);

  const mime = opts.mime ?? "image/jpeg";
  const quality = opts.quality ?? 0.92;
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("فشل توليد الصورة"))),
      mime,
      quality,
    );
  });
}

export function suggestEditedName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : ".jpg";
  return `${base}-edited${ext}`;
}
