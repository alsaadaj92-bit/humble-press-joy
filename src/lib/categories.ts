// Local, deterministic categorization of photos into Google-Photos-style
// buckets (Videos, Selfies, Screenshots, Documents, Favorites). Uses only
// signals already computed on-device (EXIF, dimensions, faces, OCR).
// No network calls, no cloud.
import type { MockPhoto } from "./mockPhotos";
import type { PhotoState, FaceRow, OcrRow } from "./photoDb";

export type CategoryId =
  | "videos"
  | "selfies"
  | "screenshots"
  | "documents"
  | "favorites";

export interface CategorySignals {
  states?: Map<string, PhotoState>;
  faces?: FaceRow[];        // all faces across library
  ocr?: OcrRow[];           // all OCR rows across library
}

export interface CategoryBuckets {
  videos: MockPhoto[];
  selfies: MockPhoto[];
  screenshots: MockPhoto[];
  documents: MockPhoto[];
  favorites: MockPhoto[];
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  videos: "الفيديوهات",
  selfies: "السيلفي",
  screenshots: "لقطات الشاشة",
  documents: "المستندات",
  favorites: "المفضلة",
};

export function isVideo(p: MockPhoto): boolean {
  return p.kind === "video" || (p.mime?.startsWith("video/") ?? false);
}

/** Heuristic: screenshots usually have no EXIF camera and match a common
 * device aspect ratio (portrait or landscape phone/tablet screens). */
export function isScreenshot(
  p: MockPhoto,
  state?: PhotoState,
): boolean {
  if (isVideo(p)) return false;
  const nameHit = /screenshot|screen[_ -]?shot|لقطة|شاشة/i.test(p.name);
  if (nameHit) return true;
  const cam = state?.exif?.camera;
  if (cam) return false; // real camera = not a screenshot
  const w = p.width, h = p.height;
  if (!w || !h) return false;
  const r = w / h;
  // Common phone/tablet/desktop screen ratios (±3%).
  const ratios = [9 / 16, 9 / 19.5, 9 / 20, 3 / 4, 16 / 9, 19.5 / 9, 20 / 9, 4 / 3, 16 / 10];
  return ratios.some((t) => Math.abs(r - t) / t < 0.03);
}

/** Selfie heuristic: a single large face taking >18% of the frame,
 * roughly centered. */
export function isSelfie(p: MockPhoto, faces: FaceRow[]): boolean {
  if (isVideo(p)) return false;
  const own = faces.filter((f) => f.assetId === p.id);
  if (own.length === 0 || own.length > 2) return false;
  const w = p.width || 1, h = p.height || 1;
  const area = w * h;
  const biggest = own.reduce((m, f) => Math.max(m, f.box.width * f.box.height), 0);
  return biggest / area > 0.18;
}

/** Document/receipt heuristic: OCR extracted >120 chars with decent
 * confidence. */
export function isDocument(p: MockPhoto, ocr: OcrRow[]): boolean {
  if (isVideo(p)) return false;
  const row = ocr.find((o) => o.id === p.id);
  if (!row) return false;
  return row.text.replace(/\s+/g, "").length > 120 && row.confidence > 55;
}

export function categorize(
  photos: MockPhoto[],
  signals: CategorySignals = {},
): CategoryBuckets {
  const { states = new Map(), faces = [], ocr = [] } = signals;
  const buckets: CategoryBuckets = {
    videos: [],
    selfies: [],
    screenshots: [],
    documents: [],
    favorites: [],
  };
  for (const p of photos) {
    const s = states.get(p.id);
    if (s?.trashedAt) continue;
    if (isVideo(p)) buckets.videos.push(p);
    if (s?.favorite) buckets.favorites.push(p);
    if (isSelfie(p, faces)) buckets.selfies.push(p);
    if (isScreenshot(p, s)) buckets.screenshots.push(p);
    if (isDocument(p, ocr)) buckets.documents.push(p);
  }
  return buckets;
}

export function countBuckets(b: CategoryBuckets): Record<CategoryId, number> {
  return {
    videos: b.videos.length,
    selfies: b.selfies.length,
    screenshots: b.screenshots.length,
    documents: b.documents.length,
    favorites: b.favorites.length,
  };
}
