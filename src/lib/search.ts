// Local smart search. Zero network — parses user queries into filters
// and matches against MockPhoto metadata + optional EXIF/state context.
//
// Supported tokens (space-separated, combinable):
//   year:2024              exact year
//   month:يناير | month:january | month:6
//   camera:canon           substring on EXIF camera/lens
//   place:الشرق | place:europe
//   has:gps | has:camera
//   is:favorite | is:archived | is:trashed
//   ext:jpg | ext:png
//   min:2023-05  max:2024-12   inclusive date bounds (YYYY or YYYY-MM)
// Any bare word matches file name, camera, region label, or year text.

import type { MockPhoto } from "./mockPhotos";
import type { ExifData } from "./exif";
import type { PhotoState } from "./photoDb";
import { regionLabel } from "./places";

export interface SearchContext {
  states: Map<string, PhotoState>;
  /** Map photoId -> exif (falls back to state.exif). */
  exifById?: Map<string, ExifData | undefined>;
}

export interface ParsedQuery {
  terms: string[];
  year?: number;
  month?: number; // 1-12
  camera?: string;
  place?: string;
  has: { gps?: boolean; camera?: boolean };
  is: { favorite?: boolean; archived?: boolean; trashed?: boolean };
  ext?: string;
  min?: { y: number; m: number };
  max?: { y: number; m: number };
}

const AR_MONTHS: Record<string, number> = {
  "يناير": 1, "كانون الثاني": 1,
  "فبراير": 2, "شباط": 2,
  "مارس": 3, "آذار": 3,
  "أبريل": 4, "ابريل": 4, "نيسان": 4,
  "مايو": 5, "أيار": 5, "ايار": 5,
  "يونيو": 6, "حزيران": 6,
  "يوليو": 7, "تموز": 7,
  "أغسطس": 8, "اغسطس": 8, "آب": 8,
  "سبتمبر": 9, "أيلول": 9, "ايلول": 9,
  "أكتوبر": 10, "اكتوبر": 10, "تشرين الأول": 10,
  "نوفمبر": 11, "تشرين الثاني": 11,
  "ديسمبر": 12, "كانون الأول": 12,
};

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function parseMonth(v: string): number | undefined {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  const low = v.toLowerCase();
  if (EN_MONTHS[low]) return EN_MONTHS[low];
  for (const [k, m] of Object.entries(AR_MONTHS)) {
    if (v.includes(k)) return m;
  }
  return undefined;
}

function parseYm(v: string): { y: number; m: number } | undefined {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v);
  if (!m) return undefined;
  return { y: Number(m[1]), m: m[2] ? Number(m[2]) : 0 };
}

export function parseQuery(input: string): ParsedQuery {
  const q: ParsedQuery = { terms: [], has: {}, is: {} };
  if (!input) return q;
  const tokens = input.trim().split(/\s+/);
  for (const raw of tokens) {
    const [rawKey, ...rest] = raw.split(":");
    const value = rest.join(":");
    if (!value) {
      q.terms.push(raw.toLowerCase());
      continue;
    }
    const key = rawKey.toLowerCase();
    switch (key) {
      case "year":
      case "سنة": {
        const y = Number(value);
        if (Number.isFinite(y)) q.year = y;
        break;
      }
      case "month":
      case "شهر": {
        const m = parseMonth(value);
        if (m) q.month = m;
        break;
      }
      case "camera":
      case "كاميرا":
        q.camera = value.toLowerCase();
        break;
      case "place":
      case "مكان":
        q.place = value.toLowerCase();
        break;
      case "has": {
        const v = value.toLowerCase();
        if (v === "gps" || v === "location") q.has.gps = true;
        if (v === "camera") q.has.camera = true;
        break;
      }
      case "is": {
        const v = value.toLowerCase();
        if (v === "favorite" || v === "fav" || v === "مفضلة") q.is.favorite = true;
        if (v === "archived" || v === "أرشيف") q.is.archived = true;
        if (v === "trashed" || v === "محذوف") q.is.trashed = true;
        break;
      }
      case "ext":
        q.ext = value.toLowerCase().replace(/^\./, "");
        break;
      case "min": {
        const ym = parseYm(value);
        if (ym) q.min = ym;
        break;
      }
      case "max": {
        const ym = parseYm(value);
        if (ym) q.max = ym;
        break;
      }
      default:
        q.terms.push(raw.toLowerCase());
    }
  }
  return q;
}

function afterMin(d: Date, min: { y: number; m: number }): boolean {
  if (d.getFullYear() > min.y) return true;
  if (d.getFullYear() < min.y) return false;
  return min.m === 0 || d.getMonth() + 1 >= min.m;
}
function beforeMax(d: Date, max: { y: number; m: number }): boolean {
  if (d.getFullYear() < max.y) return true;
  if (d.getFullYear() > max.y) return false;
  return max.m === 0 || d.getMonth() + 1 <= max.m;
}

export function matchPhoto(
  photo: MockPhoto,
  q: ParsedQuery,
  ctx: SearchContext,
): boolean {
  const state = ctx.states.get(photo.id);
  const exif = ctx.exifById?.get(photo.id) ?? state?.exif;
  const cam = (exif?.camera ?? "") + " " + (exif?.lens ?? "");
  const region = exif?.gps ? regionLabel(exif.gps.lat, exif.gps.lon) : "";
  const yearStr = String(photo.date.getFullYear());

  if (q.year !== undefined && photo.date.getFullYear() !== q.year) return false;
  if (q.month !== undefined && photo.date.getMonth() + 1 !== q.month) return false;
  if (q.min && !afterMin(photo.date, q.min)) return false;
  if (q.max && !beforeMax(photo.date, q.max)) return false;
  if (q.camera && !cam.toLowerCase().includes(q.camera)) return false;
  if (q.place && !region.toLowerCase().includes(q.place)) return false;
  if (q.has.gps && !exif?.gps) return false;
  if (q.has.camera && !exif?.camera) return false;
  if (q.is.favorite && !state?.favorite) return false;
  if (q.is.archived && !state?.archived) return false;
  if (q.is.trashed && !state?.trashedAt) return false;
  if (q.ext) {
    const m = /\.([a-z0-9]+)$/i.exec(photo.name);
    if (!m || m[1].toLowerCase() !== q.ext) return false;
  }

  if (q.terms.length) {
    const hay = [
      photo.name,
      yearStr,
      cam,
      region,
      photo.provider ?? "",
    ]
      .join(" ")
      .toLowerCase();
    for (const t of q.terms) {
      if (!hay.includes(t)) return false;
    }
  }
  return true;
}

export function searchPhotos(
  photos: MockPhoto[],
  query: string,
  ctx: SearchContext,
): MockPhoto[] {
  if (!query.trim()) return photos;
  const q = parseQuery(query);
  return photos.filter((p) => matchPhoto(p, q, ctx));
}

/** Human-readable chips describing what got parsed. */
export function describeQuery(q: ParsedQuery): string[] {
  const out: string[] = [];
  if (q.year !== undefined) out.push(`سنة: ${q.year}`);
  if (q.month !== undefined) out.push(`شهر: ${q.month}`);
  if (q.camera) out.push(`كاميرا: ${q.camera}`);
  if (q.place) out.push(`مكان: ${q.place}`);
  if (q.has.gps) out.push("لديها موقع");
  if (q.has.camera) out.push("لديها كاميرا");
  if (q.is.favorite) out.push("مفضلة");
  if (q.is.archived) out.push("مؤرشفة");
  if (q.is.trashed) out.push("محذوفة");
  if (q.ext) out.push(`.${q.ext}`);
  if (q.min) out.push(`من ${q.min.y}${q.min.m ? "-" + q.min.m : ""}`);
  if (q.max) out.push(`إلى ${q.max.y}${q.max.m ? "-" + q.max.m : ""}`);
  return out;
}
