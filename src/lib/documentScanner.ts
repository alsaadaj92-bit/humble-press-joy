// Local Document Scanner — takes a photo (or image blob), auto-detects the
// document quadrilateral via a lightweight edge/corner scan, applies a
// perspective warp to a rectangular canvas, and enhances contrast / applies
// B&W mode. Everything runs in-canvas. No cloud calls.

export interface Point { x: number; y: number; }
export interface Quad { tl: Point; tr: Point; br: Point; bl: Point; }

export type ScanMode = "color" | "grayscale" | "bw";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("image load failed"));
      img.src = url;
    });
  } finally {
    // let caller keep url via re-blob if needed; revoke after decode is safe
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Very lightweight document quad detection.
 *  Downsamples, computes brightness gradient, then finds the extreme
 *  "content" pixels in each quadrant to estimate corners. Works well for a
 *  page on a darker surface — good enough for a v1 local scanner. */
export function detectDocumentQuad(img: HTMLImageElement): Quad {
  const scale = 200 / Math.max(img.width, img.height);
  const w = Math.max(64, Math.round(img.width * scale));
  const h = Math.max(64, Math.round(img.height * scale));
  const cnv = document.createElement("canvas");
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // luminance
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  // threshold at mean + slight bias
  let sum = 0;
  for (let i = 0; i < lum.length; i++) sum += lum[i];
  const mean = sum / lum.length;
  const thr = mean * 0.9;

  // find topmost, leftmost, etc. "bright" (content) pixels
  const cx = w / 2, cy = h / 2;
  let tl = { x: 0, y: 0 }, tr = { x: w - 1, y: 0 };
  let bl = { x: 0, y: h - 1 }, br = { x: w - 1, y: h - 1 };
  let dTl = -1, dTr = -1, dBl = -1, dBr = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum[y * w + x] < thr) continue;
      if (x < cx && y < cy) {
        const d = (cx - x) + (cy - y);
        if (d > dTl) { dTl = d; tl = { x, y }; }
      } else if (x >= cx && y < cy) {
        const d = (x - cx) + (cy - y);
        if (d > dTr) { dTr = d; tr = { x, y }; }
      } else if (x < cx && y >= cy) {
        const d = (cx - x) + (y - cy);
        if (d > dBl) { dBl = d; bl = { x, y }; }
      } else {
        const d = (x - cx) + (y - cy);
        if (d > dBr) { dBr = d; br = { x, y }; }
      }
    }
  }

  // upscale back to original image space
  const up = (p: Point) => ({ x: p.x / scale, y: p.y / scale });
  return { tl: up(tl), tr: up(tr), br: up(br), bl: up(bl) };
}

/** Default quad = 10% inset — used as a safe starting point for manual adjust. */
export function defaultQuad(img: HTMLImageElement): Quad {
  const mx = img.width * 0.08, my = img.height * 0.08;
  return {
    tl: { x: mx, y: my },
    tr: { x: img.width - mx, y: my },
    br: { x: img.width - mx, y: img.height - my },
    bl: { x: mx, y: img.height - my },
  };
}

// ----- Perspective warp via bilinear inverse-mapping -----
// For each destination pixel, compute the corresponding source point using
// bilinear interpolation of the four quad corners (fast & good enough for
// document scanning of a mostly-flat page).

function bilerp(q: Quad, u: number, v: number): Point {
  const top = { x: q.tl.x * (1 - u) + q.tr.x * u, y: q.tl.y * (1 - u) + q.tr.y * u };
  const bot = { x: q.bl.x * (1 - u) + q.br.x * u, y: q.bl.y * (1 - u) + q.br.y * u };
  return { x: top.x * (1 - v) + bot.x * v, y: top.y * (1 - v) + bot.y * v };
}

export interface WarpOptions {
  outWidth?: number;
  outHeight?: number;
  mode?: ScanMode;
  /** contrast multiplier around 128, e.g. 1.25 */
  contrast?: number;
  /** brightness delta [-100, 100] */
  brightness?: number;
}

export function warpDocument(img: HTMLImageElement, quad: Quad, opts: WarpOptions = {}): HTMLCanvasElement {
  // estimate target aspect from quad edge lengths
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const wTop = dist(quad.tl, quad.tr);
  const wBot = dist(quad.bl, quad.br);
  const hLeft = dist(quad.tl, quad.bl);
  const hRight = dist(quad.tr, quad.br);
  const avgW = (wTop + wBot) / 2;
  const avgH = (hLeft + hRight) / 2;
  const aspect = avgW / Math.max(1, avgH);

  const outW = opts.outWidth ?? Math.max(600, Math.min(2000, Math.round(avgW)));
  const outH = opts.outHeight ?? Math.round(outW / Math.max(0.2, aspect));

  const src = document.createElement("canvas");
  src.width = img.width; src.height = img.height;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, img.width, img.height).data;

  const out = document.createElement("canvas");
  out.width = outW; out.height = outH;
  const octx = out.getContext("2d")!;
  const oid = octx.createImageData(outW, outH);
  const od = oid.data;

  const mode = opts.mode ?? "color";
  const contrast = opts.contrast ?? (mode === "bw" ? 1.6 : 1.2);
  const brightness = opts.brightness ?? (mode === "bw" ? 10 : 4);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const u = x / (outW - 1);
      const v = y / (outH - 1);
      const p = bilerp(quad, u, v);
      const sx = clamp(Math.round(p.x), 0, img.width - 1);
      const sy = clamp(Math.round(p.y), 0, img.height - 1);
      const si = (sy * img.width + sx) * 4;
      let r = srcData[si], g = srcData[si + 1], b = srcData[si + 2];

      // contrast + brightness
      r = clamp((r - 128) * contrast + 128 + brightness, 0, 255);
      g = clamp((g - 128) * contrast + 128 + brightness, 0, 255);
      b = clamp((b - 128) * contrast + 128 + brightness, 0, 255);

      if (mode === "grayscale" || mode === "bw") {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (mode === "bw") {
          const t = l > 150 ? 255 : 0;
          r = g = b = t;
        } else {
          r = g = b = l;
        }
      }

      const oi = (y * outW + x) * 4;
      od[oi] = r; od[oi + 1] = g; od[oi + 2] = b; od[oi + 3] = 255;
    }
  }

  octx.putImageData(oid, 0, 0);
  return out;
}

export function canvasToBlob(cnv: HTMLCanvasElement, type = "image/png", quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    cnv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality),
  );
}

/** Bundle one or more warped scan canvases into a single-page-per-image PDF (minimal, no deps). */
export async function scansToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (!canvases.length) throw new Error("no pages");
  // Simple PDF: each page uses a JPEG XObject. Written by hand to avoid deps.
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const push = (s: string | Uint8Array) => {
    const u = typeof s === "string" ? enc.encode(s) : s;
    chunks.push(u); offset += u.length;
  };
  const track = () => offsets.push(offset);

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const pageObjs: number[] = [];
  const imageObjs: number[] = [];
  const contentObjs: number[] = [];

  // Reserve object numbers: 1 = Catalog, 2 = Pages, then per-page (img, content, page).
  const catalogNo = 1;
  const pagesNo = 2;
  let nextNo = 3;

  const pageMeta: { w: number; h: number; imgNo: number; contentNo: number; pageNo: number; jpg: Uint8Array }[] = [];

  for (const cnv of canvases) {
    const blob = await canvasToBlob(cnv, "image/jpeg", 0.85);
    const jpg = new Uint8Array(await blob.arrayBuffer());
    const imgNo = nextNo++;
    const contentNo = nextNo++;
    const pageNo = nextNo++;
    pageMeta.push({ w: cnv.width, h: cnv.height, imgNo, contentNo, pageNo, jpg });
  }

  // Write image objects
  for (const m of pageMeta) {
    track(); imageObjs.push(offset);
    push(`${m.imgNo} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.jpg.length} >>\nstream\n`);
    push(m.jpg);
    push("\nendstream\nendobj\n");
  }

  // Content streams (draw image at page size)
  for (const m of pageMeta) {
    const stream = `q\n${m.w} 0 0 ${m.h} 0 0 cm\n/Im0 Do\nQ\n`;
    track(); contentObjs.push(offset);
    push(`${m.contentNo} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  }

  // Page objects
  for (const m of pageMeta) {
    track(); pageObjs.push(offset);
    push(`${m.pageNo} 0 obj\n<< /Type /Page /Parent ${pagesNo} 0 R /MediaBox [0 0 ${m.w} ${m.h}] /Resources << /XObject << /Im0 ${m.imgNo} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${m.contentNo} 0 R >>\nendobj\n`);
  }

  // Pages
  const pagesEntry = offset;
  push(`${pagesNo} 0 obj\n<< /Type /Pages /Count ${pageMeta.length} /Kids [${pageMeta.map((m) => `${m.pageNo} 0 R`).join(" ")}] >>\nendobj\n`);

  // Catalog
  const catalogEntry = offset;
  push(`${catalogNo} 0 obj\n<< /Type /Catalog /Pages ${pagesNo} 0 R >>\nendobj\n`);

  // xref
  const xrefStart = offset;
  const total = nextNo; // objects 1..nextNo-1
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  // Build in order 1..total-1
  const objOffsets: Record<number, number> = {};
  objOffsets[catalogNo] = catalogEntry;
  objOffsets[pagesNo] = pagesEntry;
  let idx = 0;
  for (const m of pageMeta) {
    objOffsets[m.imgNo] = imageObjs[idx];
    objOffsets[m.contentNo] = contentObjs[idx];
    objOffsets[m.pageNo] = pageObjs[idx];
    idx++;
  }
  for (let i = 1; i < total; i++) {
    const off = objOffsets[i] ?? 0;
    push(off.toString().padStart(10, "0") + " 00000 n \n");
  }
  push(`trailer\n<< /Size ${total} /Root ${catalogNo} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return new Blob([out], { type: "application/pdf" });
}
