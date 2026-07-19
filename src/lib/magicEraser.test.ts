import { describe, it, expect } from "vitest";
import { inpaint } from "./magicEraser";

// Minimal ImageData polyfill for jsdom (which lacks it).
class ID {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace = "srgb" as const;
  constructor(data: Uint8ClampedArray, w: number, h: number) {
    this.data = data;
    this.width = w;
    this.height = h;
  }
}
(globalThis as unknown as { ImageData: typeof ID }).ImageData ??= ID;

describe("magicEraser.inpaint", () => {
  it("fills a hole with the average of surrounding pixels", () => {
    const w = 5, h = 5;
    const px = new Uint8ClampedArray(w * h * 4);
    // fill with solid red
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = 200;
      px[i * 4 + 1] = 20;
      px[i * 4 + 2] = 20;
      px[i * 4 + 3] = 255;
    }
    const src = new ID(px, w, h) as unknown as ImageData;
    const mask = new Uint8ClampedArray(w * h);
    const centre = 2 * w + 2;
    mask[centre] = 255;
    const out = inpaint(src, mask, { passes: 20, feather: 0 });
    const o = centre * 4;
    // centre should reconstruct to something very close to solid red
    expect(Math.abs(out.data[o] - 200)).toBeLessThan(15);
    expect(Math.abs(out.data[o + 1] - 20)).toBeLessThan(15);
    expect(out.data[o + 3]).toBe(255);
  });
});
