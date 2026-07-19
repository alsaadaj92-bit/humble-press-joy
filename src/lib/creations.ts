// Local-only "Creations": collages, short movies, and animations.
// All rendering happens in a Canvas + MediaRecorder — no cloud, no upload.
import type { MockPhoto } from "./mockPhotos";

export type CreationKind = "collage" | "movie" | "animation";

export interface CollageOptions {
  width?: number;
  height?: number;
  gap?: number;
  background?: string;
  rounded?: number;
}

export interface MovieOptions {
  width?: number;
  height?: number;
  fps?: number;
  perPhotoSeconds?: number;   // display time per photo
  crossfadeSeconds?: number;  // overlap between photos
  kenBurns?: boolean;         // subtle pan/zoom
  background?: string;
}

export interface AnimationOptions {
  width?: number;
  height?: number;
  fps?: number;
  frameDurationMs?: number;
}

/** Deterministic grid dims for a collage of N photos. */
export function collageGrid(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load failed: ${src}`));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  scale = 1,
  offsetX = 0, offsetY = 0,
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  // apply ken-burns scale by cropping tighter
  const zoom = 1 / scale;
  const zsw = sw * zoom;
  const zsh = sh * zoom;
  const zsx = sx + (sw - zsw) * (0.5 + offsetX * 0.4);
  const zsy = sy + (sh - zsh) * (0.5 + offsetY * 0.4);
  ctx.drawImage(img, zsx, zsy, zsw, zsh, x, y, w, h);
}

/** Build a grid collage PNG from photos. */
export async function buildCollage(
  photos: MockPhoto[],
  opts: CollageOptions = {},
): Promise<Blob> {
  const {
    width = 1600, height = 1600, gap = 12,
    background = "#0b0b0b", rounded = 16,
  } = opts;
  if (!photos.length) throw new Error("no photos");
  const { cols, rows } = collageGrid(photos.length);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const cellW = (width - gap * (cols + 1)) / cols;
  const cellH = (height - gap * (rows + 1)) / rows;

  const srcs = photos.slice(0, cols * rows).map((p) => p.fullSrc ?? p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/800`);
  const images = await Promise.all(srcs.map((s) => loadImage(s).catch(() => null)));

  images.forEach((img, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = gap + c * (cellW + gap);
    const y = gap + r * (cellH + gap);
    ctx.save();
    // rounded rect clip
    const rr = rounded;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + cellW, y, x + cellW, y + cellH, rr);
    ctx.arcTo(x + cellW, y + cellH, x, y + cellH, rr);
    ctx.arcTo(x, y + cellH, x, y, rr);
    ctx.arcTo(x, y, x + cellW, y, rr);
    ctx.closePath();
    ctx.clip();
    if (img) {
      drawCover(ctx, img, x, y, cellW, cellH);
    } else {
      ctx.fillStyle = "#222";
      ctx.fillRect(x, y, cellW, cellH);
    }
    ctx.restore();
  });

  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"),
  );
}

function pickMimeType(): string {
  const cands = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of cands) {
    // @ts-expect-error isTypeSupported exists on MediaRecorder
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "video/webm";
}

/** Build a short "movie" (WebM) from photos with Ken Burns pan/zoom + crossfades. */
export async function buildMovie(
  photos: MockPhoto[],
  opts: MovieOptions = {},
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const {
    width = 1280, height = 720, fps = 30,
    perPhotoSeconds = 2.2, crossfadeSeconds = 0.5,
    kenBurns = true, background = "#000",
  } = opts;
  if (!photos.length) throw new Error("no photos");
  if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder unavailable");

  const srcs = photos.map((p) => p.fullSrc ?? p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/1600`);
  const images = await Promise.all(srcs.map((s) => loadImage(s).catch(() => null)));
  const usable = images.filter((i): i is HTMLImageElement => !!i);
  if (!usable.length) throw new Error("no images loaded");

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(200);

  const perFrames = Math.round(perPhotoSeconds * fps);
  const xfFrames = Math.round(crossfadeSeconds * fps);
  const totalFrames = perFrames * usable.length - xfFrames * (usable.length - 1);
  const frameDurMs = 1000 / fps;

  for (let f = 0; f < totalFrames; f++) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // find which two photos are active at this frame
    for (let i = 0; i < usable.length; i++) {
      const startF = i * (perFrames - xfFrames);
      const endF = startF + perFrames;
      if (f < startF || f >= endF) continue;
      const local = f - startF;
      // fade in first xfFrames (except very first photo), fade out last xfFrames (except last photo)
      let alpha = 1;
      if (i > 0 && local < xfFrames) alpha = local / xfFrames;
      if (i < usable.length - 1 && local > perFrames - xfFrames) {
        alpha = Math.min(alpha, (perFrames - local) / xfFrames);
      }
      const t = local / perFrames;
      const scale = kenBurns ? 1 + t * 0.08 : 1;
      const ox = kenBurns ? (i % 2 === 0 ? t : -t) : 0;
      const oy = kenBurns ? (i % 2 === 0 ? -t * 0.5 : t * 0.5) : 0;
      ctx.globalAlpha = alpha;
      drawCover(ctx, usable[i], 0, 0, width, height, scale, ox, oy);
    }
    ctx.globalAlpha = 1;

    onProgress?.(f / totalFrames);
    await new Promise((r) => setTimeout(r, frameDurMs));
  }

  rec.stop();
  await stopped;
  return new Blob(chunks, { type: "video/webm" });
}

/** Build a looping "animation" (WebM) that cycles frames like a GIF. */
export async function buildAnimation(
  photos: MockPhoto[],
  opts: AnimationOptions = {},
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const { width = 720, height = 720, fps = 12, frameDurationMs = 200 } = opts;
  if (!photos.length) throw new Error("no photos");
  const framesPerImage = Math.max(1, Math.round((frameDurationMs / 1000) * fps));
  return await buildMovie(
    photos,
    {
      width, height, fps,
      perPhotoSeconds: framesPerImage / fps,
      crossfadeSeconds: 0,
      kenBurns: false,
    },
    onProgress,
  );
}
