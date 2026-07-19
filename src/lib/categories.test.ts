import { describe, it, expect } from "vitest";
import { categorize, isScreenshot, isSelfie, isDocument } from "./categories";
import type { MockPhoto } from "./mockPhotos";
import type { FaceRow, OcrRow, PhotoState } from "./photoDb";

const photo = (over: Partial<MockPhoto>): MockPhoto => ({
  id: "p", seed: "s", width: 400, height: 400,
  date: new Date(), name: "IMG_0001.jpg", ...over,
});

describe("categories", () => {
  it("detects screenshots by aspect ratio & missing camera", () => {
    expect(isScreenshot(photo({ id: "a", width: 1170, height: 2532 }))).toBe(true);
    expect(isScreenshot(photo({ id: "b", name: "Screenshot_2024.png", width: 100, height: 100 }))).toBe(true);
    const s: PhotoState = { id: "c", exif: { camera: "Canon EOS R6" } as PhotoState["exif"] };
    expect(isScreenshot(photo({ id: "c", width: 1170, height: 2532 }), s)).toBe(false);
  });

  it("detects selfies via large centered face", () => {
    const face: FaceRow = {
      id: "a:0", assetId: "a", descriptor: [], detectedAt: 0,
      box: { x: 50, y: 50, width: 250, height: 250 },
    };
    expect(isSelfie(photo({ id: "a", width: 400, height: 400 }), [face])).toBe(true);
    expect(isSelfie(photo({ id: "z", width: 400, height: 400 }), [])).toBe(false);
  });

  it("detects documents from long OCR text", () => {
    const ocr: OcrRow = {
      id: "a", text: "x".repeat(200), lang: "eng", confidence: 80, updatedAt: 0,
    };
    expect(isDocument(photo({ id: "a" }), [ocr])).toBe(true);
    expect(isDocument(photo({ id: "b" }), [ocr])).toBe(false);
  });

  it("categorizes into buckets and skips trashed items", () => {
    const photos = [
      photo({ id: "v1", kind: "video", mime: "video/mp4" }),
      photo({ id: "s1", width: 1170, height: 2532 }),
      photo({ id: "f1" }),
      photo({ id: "t1" }),
    ];
    const states = new Map<string, PhotoState>([
      ["f1", { id: "f1", favorite: true }],
      ["t1", { id: "t1", trashedAt: Date.now() }],
    ]);
    const b = categorize(photos, { states });
    expect(b.videos.map((p) => p.id)).toEqual(["v1"]);
    expect(b.screenshots.map((p) => p.id)).toEqual(["s1"]);
    expect(b.favorites.map((p) => p.id)).toEqual(["f1"]);
    expect(b.videos.concat(b.screenshots, b.favorites).find((p) => p.id === "t1")).toBeUndefined();
  });
});
