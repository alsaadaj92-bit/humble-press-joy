// Timeline scrubber buckets — pure, deterministic year/month grouping.
import type { MockPhoto } from "./mockPhotos";

export interface TimelineBucket {
  key: string;    // "YYYY-MM"
  year: number;
  month: number; // 1..12
  label: string; // localized "شهر YYYY"
  count: number;
}

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${AR_MONTHS[month - 1]} ${year}`;
}

/** Group photos into month buckets sorted newest-first. */
export function buildTimelineBuckets(photos: MockPhoto[]): TimelineBucket[] {
  const map = new Map<string, TimelineBucket>();
  for (const p of photos) {
    const key = monthKey(p.date);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const year = p.date.getFullYear();
      const month = p.date.getMonth() + 1;
      map.set(key, { key, year, month, label: monthLabel(year, month), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/** Collapse buckets to year markers (used for the compact rail). */
export interface YearMarker {
  year: number;
  count: number;
  firstKey: string; // month-key of newest bucket in that year (for scroll target)
}

export function collapseToYears(buckets: TimelineBucket[]): YearMarker[] {
  const map = new Map<number, YearMarker>();
  for (const b of buckets) {
    const cur = map.get(b.year);
    if (cur) {
      cur.count += b.count;
      // firstKey stays as first-seen (buckets are newest-first, so latest month of year)
    } else {
      map.set(b.year, { year: b.year, count: b.count, firstKey: b.key });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year);
}
