// Live Albums — dynamic collections defined by rules that re-evaluate
// against the local library on every render. Stored in Dexie KV as JSON.
import { photoDb, type PhotoState } from "./photoDb";
import type { MockPhoto } from "./mockPhotos";

export type LiveRuleKind =
  | "favorite"
  | "has-gps"
  | "kind-video"
  | "kind-image"
  | "year"
  | "month"
  | "camera"
  | "name-contains";

export interface LiveRule {
  kind: LiveRuleKind;
  value?: string | number; // e.g. year=2024, month=1..12, camera="Canon", name="IMG"
}

export interface LiveAlbum {
  id: string;
  name: string;
  emoji?: string;
  rules: LiveRule[];        // ALL rules must match (AND)
  createdAt: number;
  updatedAt: number;
}

const KV_KEY = "live-albums.v1";

export async function getLiveAlbums(): Promise<LiveAlbum[]> {
  const row = await photoDb.kv.get(KV_KEY);
  if (!row) return DEFAULT_LIVE_ALBUMS();
  try {
    const parsed = JSON.parse(row.value) as LiveAlbum[];
    return Array.isArray(parsed) ? parsed : DEFAULT_LIVE_ALBUMS();
  } catch {
    return DEFAULT_LIVE_ALBUMS();
  }
}

export async function saveLiveAlbums(albums: LiveAlbum[]): Promise<void> {
  await photoDb.kv.put({ key: KV_KEY, value: JSON.stringify(albums) });
}

export function DEFAULT_LIVE_ALBUMS(): LiveAlbum[] {
  const now = Date.now();
  return [
    {
      id: "live-favorites",
      name: "المفضلة الحية",
      emoji: "❤️",
      rules: [{ kind: "favorite" }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "live-videos",
      name: "كل الفيديوهات",
      emoji: "🎬",
      rules: [{ kind: "kind-video" }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "live-geo",
      name: "الصور مع موقع",
      emoji: "📍",
      rules: [{ kind: "has-gps" }],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function evaluate(
  photo: MockPhoto,
  state: PhotoState | undefined,
  rules: LiveRule[],
): boolean {
  for (const r of rules) {
    if (!matchRule(photo, state, r)) return false;
  }
  return true;
}

function matchRule(
  photo: MockPhoto,
  state: PhotoState | undefined,
  rule: LiveRule,
): boolean {
  switch (rule.kind) {
    case "favorite":
      return !!state?.favorite;
    case "has-gps":
      return !!state?.exif?.gps;
    case "kind-video":
      return photo.kind === "video";
    case "kind-image":
      return photo.kind !== "video";
    case "year":
      return photo.date.getFullYear() === Number(rule.value);
    case "month":
      return photo.date.getMonth() + 1 === Number(rule.value);
    case "camera": {
      const cam = state?.exif?.camera?.toLowerCase() ?? "";
      return cam.includes(String(rule.value ?? "").toLowerCase());
    }
    case "name-contains":
      return photo.name.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
    default:
      return false;
  }
}

export function describeRule(r: LiveRule): string {
  switch (r.kind) {
    case "favorite": return "مفضّلة";
    case "has-gps": return "لها إحداثيات GPS";
    case "kind-video": return "فيديو";
    case "kind-image": return "صورة ثابتة";
    case "year": return `سنة ${r.value}`;
    case "month": return `شهر ${r.value}`;
    case "camera": return `كاميرا يحوي "${r.value}"`;
    case "name-contains": return `الاسم يحوي "${r.value}"`;
  }
}
