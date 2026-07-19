// Local-only "Magic Eraser" — iterative diffusion inpainting.
// A masked region is filled by repeatedly averaging each hole pixel with
// its non-hole neighbours. Runs on a plain 2D canvas. No network, no ML.

export interface EraseOptions {
  /** Number of diffusion passes. More = smoother fill, slower. */
  passes?: number;
  /** Optional feather radius (px) around the mask for a soft blend. */
  feather?: number;
}

/**
 * Inpaint the masked pixels of `source` and return a new ImageData.
 * @param source   Full-resolution source image data (RGBA).
 * @param mask     Same-size single-channel mask; >0 = pixel to erase.
 */
export function inpaint(
  source: ImageData,
  mask: Uint8ClampedArray,
  opts: EraseOptions = {},
): ImageData {
  const { passes = 40, feather = 2 } = opts;
  const { width: w, height: h } = source;
  if (mask.length !== w * h) throw new Error("mask size mismatch");

  const out = new Uint8ClampedArray(source.data);
  const hole = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) hole[i] = mask[i] > 0 ? 1 : 0;

  // Seed hole pixels to a neutral value so the average starts sensibly.
  for (let i = 0; i < hole.length; i++) {
    if (hole[i]) {
      const o = i * 4;
      out[o] = 128;
      out[o + 1] = 128;
      out[o + 2] = 128;
    }
  }

  const scratch = new Uint8ClampedArray(out.length);
  for (let p = 0; p < passes; p++) {
    scratch.set(out);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!hole[idx]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const j = (yy * w + xx) * 4;
            r += scratch[j];
            g += scratch[j + 1];
            b += scratch[j + 2];
            n++;
          }
        }
        if (n) {
          const o = idx * 4;
          out[o] = r / n;
          out[o + 1] = g / n;
          out[o + 2] = b / n;
          out[o + 3] = 255;
        }
      }
    }
  }

  // Feather: blend the inpainted region into original pixels near the border.
  if (feather > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (hole[idx]) continue;
        // distance to nearest hole (Chebyshev, cheap)
        let minD = feather + 1;
        for (let dy = -feather; dy <= feather && minD > 0; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -feather; dx <= feather; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (hole[yy * w + xx]) {
              const d = Math.max(Math.abs(dx), Math.abs(dy));
              if (d < minD) minD = d;
            }
          }
        }
        if (minD <= feather) {
          const t = 1 - minD / (feather + 1); // near hole → blend more
          const o = idx * 4;
          out[o] = source.data[o] * (1 - t) + out[o] * t;
          out[o + 1] = source.data[o + 1] * (1 - t) + out[o + 1] * t;
          out[o + 2] = source.data[o + 2] * (1 - t) + out[o + 2] * t;
        }
      }
    }
  }

  return new ImageData(out, w, h);
}

/** Convenience: run inpaint on an <img>/canvas and return a PNG blob. */
export async function eraseToBlob(
  img: HTMLImageElement | HTMLCanvasElement,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: EraseOptions,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  const src = ctx.getImageData(0, 0, width, height);
  const result = inpaint(src, mask, opts);
  ctx.putImageData(result, 0, 0);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}
