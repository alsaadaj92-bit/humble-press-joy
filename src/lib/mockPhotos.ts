// Mock photo data source — Phase 1 uses picsum.photos with stable seeds
// so images don't shuffle between renders.

export interface MockPhoto {
  id: string;
  seed: string;
  width: number;
  height: number;
  date: Date;
  name: string;
}

const HEIGHTS = [320, 400, 500, 380, 460, 540, 360, 420, 480, 600, 340, 520];
const WIDTHS = [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400];

/** Deterministic mock library grouped naturally by descending date. */
export function generateMockPhotos(count = 64): MockPhoto[] {
  const photos: MockPhoto[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    // spread photos across the past ~5 months
    date.setDate(now.getDate() - Math.floor(i * 2.3));
    const h = HEIGHTS[i % HEIGHTS.length];
    const w = WIDTHS[i % WIDTHS.length];
    photos.push({
      id: `photo-${i}`,
      seed: `lgp-${i}`,
      width: w,
      height: h,
      date,
      name: `IMG_${String(2000 + i).padStart(4, "0")}.jpg`,
    });
  }
  return photos;
}

export function picsumUrl(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export function picsumThumb(seed: string, w = 400) {
  // Thumbnail — keep aspect via seed's own ratio
  return `https://picsum.photos/seed/${seed}/${w}`;
}

/** Group photos by human-readable month/day label (Arabic locale). */
export function groupByDate(photos: MockPhoto[]) {
  const groups = new Map<string, MockPhoto[]>();
  const formatter = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  for (const p of photos) {
    const key = formatter.format(p.date);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
