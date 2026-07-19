// Auto-generated Highlight Movies — picks the best-of photos deterministically
// from the local library (favorites, recent, memories, varied months) so users
// can produce a "year in review" style reel with one click. Zero cloud.

import type { MockPhoto } from "./mockPhotos";
import type { PhotoState } from "./photoDb";

export type HighlightMode = "recent" | "year" | "favorites" | "memories" | "mixed";

export interface HighlightPick {
  photos: MockPhoto[];
  title: string;
  subtitle: string;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** Deterministic best-of picker. Groups by month, then picks one per bucket
 *  favoring favorites, capped at `count`. */
export function pickHighlight(
  photos: MockPhoto[],
  states: Map<string, PhotoState> | Record<string, PhotoState | undefined>,
  mode: HighlightMode,
  count = 12,
): HighlightPick {
  const getState = (id: string): PhotoState | undefined =>
    states instanceof Map ? states.get(id) : states[id];
  const visible = photos.filter((p) => {
    const s = getState(p.id);
    return !s?.trashedAt && !s?.locked && p.kind !== "video";
  });
  if (!visible.length) {
    return { photos: [], title: "لا توجد صور كافية", subtitle: "أضف صوراً أولاً" };
  }


  const sortedByDateDesc = [...visible].sort((a, b) => b.date.getTime() - a.date.getTime());

  let pool: MockPhoto[] = sortedByDateDesc;
  let title = "أبرز اللحظات";
  let subtitle = `أفضل ${count} صورة من مكتبتك`;

  if (mode === "recent") {
    pool = sortedByDateDesc.slice(0, count * 3);
    title = "الأحدث";
    subtitle = `أحدث ${count} من صورك`;
  } else if (mode === "favorites") {
    pool = sortedByDateDesc.filter((p) => states[p.id]?.favorite);
    title = "المفضلة";
    subtitle = `${pool.length} صورة مفضلة`;
  } else if (mode === "year") {
    const y = new Date().getFullYear();
    pool = sortedByDateDesc.filter((p) => p.date.getFullYear() === y);
    title = `أفضل عام ${y}`;
    subtitle = "خلاصة السنة";
  } else if (mode === "memories") {
    const today = new Date();
    pool = sortedByDateDesc.filter(
      (p) => p.date.getMonth() === today.getMonth() && p.date.getFullYear() < today.getFullYear(),
    );
    title = "ذكريات من مثل هذا الشهر";
    subtitle = `${pool.length} صورة من سنوات سابقة`;
  } else {
    // mixed: balanced across months, favorites boosted
    const buckets = new Map<string, MockPhoto[]>();
    for (const p of sortedByDateDesc) {
      const k = monthKey(p.date);
      const arr = buckets.get(k) ?? [];
      arr.push(p);
      buckets.set(k, arr);
    }
    const picked: MockPhoto[] = [];
    const keys = [...buckets.keys()];
    let round = 0;
    while (picked.length < count && round < 8) {
      for (const k of keys) {
        const arr = buckets.get(k)!;
        // prefer favorite in this bucket first
        const favIdx = arr.findIndex((p) => states[p.id]?.favorite);
        const take = favIdx >= 0 ? arr.splice(favIdx, 1)[0] : arr.shift();
        if (take) picked.push(take);
        if (picked.length >= count) break;
      }
      round++;
    }
    pool = picked;
    title = "أبرز اللحظات";
    subtitle = `توليفة متوازنة من ${picked.length} صورة عبر أشهر مختلفة`;
  }

  // ensure limit
  const finalPhotos = pool.slice(0, count);
  return { photos: finalPhotos, title, subtitle };
}
