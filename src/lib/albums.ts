// Local albums: auto-year & auto-month generated from EXIF dates, plus manual.
// Each album can bind to a Telegram forum topic so future uploads for that
// date bucket route into the same topic automatically.
import { photoDb, type Album } from "./photoDb";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function yearKeyOf(d: Date) {
  return String(d.getFullYear());
}
export function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function yearAlbumId(yKey: string) {
  return `auto-year-${yKey}`;
}
export function monthAlbumId(mKey: string) {
  return `auto-month-${mKey}`;
}

export async function ensureAutoAlbumsForDate(ts: number): Promise<{
  year: Album;
  month: Album;
}> {
  const d = new Date(ts);
  const yKey = yearKeyOf(d);
  const mKey = monthKeyOf(d);
  const now = Date.now();

  const [existingY, existingM] = await Promise.all([
    photoDb.albums.get(yearAlbumId(yKey)),
    photoDb.albums.get(monthAlbumId(mKey)),
  ]);

  const year: Album = existingY ?? {
    id: yearAlbumId(yKey),
    kind: "auto-year",
    key: yKey,
    name: `صور ${yKey}`,
    createdAt: now,
    updatedAt: now,
  };
  const month: Album = existingM ?? {
    id: monthAlbumId(mKey),
    kind: "auto-month",
    key: mKey,
    name: `${MONTHS_AR[d.getMonth()]} ${yKey}`,
    createdAt: now,
    updatedAt: now,
  };
  if (!existingY) await photoDb.albums.put(year);
  if (!existingM) await photoDb.albums.put(month);
  return { year, month };
}

/** Month topic wins over year; returns undefined if neither is bound. */
export async function pickAlbumTopicForDate(
  ts: number,
): Promise<number | undefined> {
  const d = new Date(ts);
  const m = await photoDb.albums.get(monthAlbumId(monthKeyOf(d)));
  if (m?.topicId != null) return m.topicId;
  const y = await photoDb.albums.get(yearAlbumId(yearKeyOf(d)));
  return y?.topicId;
}

export async function setAlbumTopic(id: string, topicId: number | undefined) {
  await photoDb.albums.update(id, { topicId, updatedAt: Date.now() });
}

export async function getUploaderName(): Promise<string> {
  const rec = await photoDb.kv.get("uploaderName");
  return (rec?.value ?? "").trim();
}
