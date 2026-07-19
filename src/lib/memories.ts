// Memories engine — 100% local. Reuses existing photo dates to build
// "On this day", "Recent highlights", and month-anniversary stories.

import type { MockPhoto } from "./mockPhotos";

export interface MemoryStory {
  id: string;
  title: string;
  subtitle: string;
  kind: "on-this-day" | "recent" | "month-ago" | "year-recap";
  cover: MockPhoto;
  photos: MockPhoto[];
}

const sameMonthDay = (a: Date, b: Date) =>
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const daysBetween = (a: Date, b: Date) =>
  Math.abs((a.getTime() - b.getTime()) / 86400000);

export function buildMemories(photos: MockPhoto[], today = new Date()): MemoryStory[] {
  if (!photos.length) return [];
  const stories: MemoryStory[] = [];

  // 1) On this day — grouped per past year
  const onThisDay = photos.filter(
    (p) => sameMonthDay(p.date, today) && p.date.getFullYear() < today.getFullYear(),
  );
  const byYear = new Map<number, MockPhoto[]>();
  for (const p of onThisDay) {
    const y = p.date.getFullYear();
    (byYear.get(y) ?? byYear.set(y, []).get(y)!)!.push(p);
  }
  for (const [year, items] of byYear) {
    const yearsAgo = today.getFullYear() - year;
    stories.push({
      id: `otd-${year}`,
      title: `في مثل هذا اليوم · ${year}`,
      subtitle: `${yearsAgo} ${yearsAgo === 1 ? "سنة" : "سنوات"} مضت · ${items.length} صورة`,
      kind: "on-this-day",
      cover: items[0],
      photos: items,
    });
  }

  // 2) Recent highlights — last 7 days
  const recent = photos.filter((p) => daysBetween(p.date, today) <= 7);
  if (recent.length >= 3) {
    stories.push({
      id: "recent-week",
      title: "هذا الأسبوع",
      subtitle: `${recent.length} لقطة جديدة`,
      kind: "recent",
      cover: recent[0],
      photos: recent.slice(0, 24),
    });
  }

  // 3) A month ago
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoPhotos = photos.filter((p) => daysBetween(p.date, monthAgo) <= 2);
  if (monthAgoPhotos.length >= 2) {
    stories.push({
      id: "month-ago",
      title: "قبل شهر",
      subtitle: `${monthAgoPhotos.length} صورة من ذلك الأسبوع`,
      kind: "month-ago",
      cover: monthAgoPhotos[0],
      photos: monthAgoPhotos,
    });
  }

  // 4) Year recaps — top photos per past year
  const yearBuckets = new Map<number, MockPhoto[]>();
  for (const p of photos) {
    const y = p.date.getFullYear();
    if (y >= today.getFullYear()) continue;
    (yearBuckets.get(y) ?? yearBuckets.set(y, []).get(y)!)!.push(p);
  }
  for (const [year, items] of Array.from(yearBuckets.entries()).sort((a, b) => b[0] - a[0]).slice(0, 3)) {
    if (items.length < 4) continue;
    stories.push({
      id: `recap-${year}`,
      title: `ملخّص ${year}`,
      subtitle: `${items.length} صورة من تلك السنة`,
      kind: "year-recap",
      cover: items[0],
      photos: items.slice(0, 30),
    });
  }

  return stories;
}
