// Local-only duplicate detection. Groups photos that are highly likely
// to be duplicates using a combination of strong signals:
//   1. Same file size (bytes) — near-certain match for unmodified copies.
//   2. Same EXIF DateTimeOriginal (to the second) — same shutter click.
//   3. Same normalized file name — strips "(1)", "-copy", " 2" suffixes.
//
// All logic runs on plain metadata already stored in IndexedDB — no
// pixel hashing, no network, no ML weights.

import type { MockPhoto } from "./mockPhotos";
import type { PhotoState } from "./photoDb";

export type DuplicateReason = "size" | "exif-time" | "name";

export interface DuplicateGroup {
  id: string;
  reason: DuplicateReason;
  key: string;      // grouping key for debugging (size in bytes, ISO date, or name)
  photos: MockPhoto[];
}

/** "IMG_2001 (1).jpg" -> "img_2001", "photo-copy.png" -> "photo" */
export function normalizeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base
    .toLowerCase()
    .replace(/[\s-]*(copy|نسخة)\b.*$/i, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/ \d+$/g, "")
    .trim();
}

interface Signals {
  size?: number;
  exifTime?: number;
  name: string;
}

function signalsFor(p: MockPhoto, states: Map<string, PhotoState>): Signals {
  const st = states.get(p.id);
  return {
    size: (p as unknown as { size?: number }).size,
    exifTime: st?.exif?.dateTaken,
    name: p.name,
  };
}

export function findDuplicates(
  photos: MockPhoto[],
  states: Map<string, PhotoState>,
): DuplicateGroup[] {
  const bySize = new Map<number, MockPhoto[]>();
  const byExif = new Map<number, MockPhoto[]>();
  const byName = new Map<string, MockPhoto[]>();

  for (const p of photos) {
    const s = signalsFor(p, states);
    if (s.size && s.size > 0) {
      (bySize.get(s.size) ?? bySize.set(s.size, []).get(s.size)!)!.push(p);
    }
    if (s.exifTime) {
      const key = Math.floor(s.exifTime / 1000); // second precision
      (byExif.get(key) ?? byExif.set(key, []).get(key)!)!.push(p);
    }
    const norm = normalizeName(s.name);
    if (norm) (byName.get(norm) ?? byName.set(norm, []).get(norm)!)!.push(p);
  }

  const groups: DuplicateGroup[] = [];
  const covered = new Set<string>();

  const push = (reason: DuplicateReason, key: string, items: MockPhoto[]) => {
    if (items.length < 2) return;
    // avoid emitting the same set twice under a weaker signal
    const sig = items.map((p) => p.id).sort().join("|");
    if (covered.has(sig)) return;
    covered.add(sig);
    groups.push({ id: `${reason}:${key}`, reason, key, photos: items });
  };

  for (const [size, items] of bySize) push("size", String(size), items);
  for (const [ts, items] of byExif) push("exif-time", new Date(ts * 1000).toISOString(), items);
  for (const [name, items] of byName) push("name", name, items);

  return groups.sort((a, b) => b.photos.length - a.photos.length);
}
