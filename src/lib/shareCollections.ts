// Local-only "shared collections" — collections of asset IDs the user can
// copy/paste as a compact code between installs of the app.
// Nothing is uploaded anywhere; the code is a base64 JSON payload.
import { photoDb } from "./photoDb";

export interface SharedCollection {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: number;
  note?: string;
}

const KV_KEY = "sharedCollections";

export async function listCollections(): Promise<SharedCollection[]> {
  const raw = await photoDb.kv.get(KV_KEY);
  if (!raw?.value) return [];
  try {
    const parsed = JSON.parse(raw.value) as SharedCollection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(cols: SharedCollection[]) {
  await photoDb.kv.put({ key: KV_KEY, value: JSON.stringify(cols) });
}

export async function createCollection(
  name: string,
  assetIds: string[],
  note?: string,
): Promise<SharedCollection> {
  const cur = await listCollections();
  const col: SharedCollection = {
    id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "مشاركة بلا اسم",
    assetIds: Array.from(new Set(assetIds)),
    createdAt: Date.now(),
    note: note?.trim() || undefined,
  };
  await writeAll([col, ...cur]);
  return col;
}

export async function deleteCollection(id: string) {
  const cur = await listCollections();
  await writeAll(cur.filter((c) => c.id !== id));
}

export async function renameCollection(id: string, name: string) {
  const cur = await listCollections();
  await writeAll(
    cur.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)),
  );
}

/** Encode a collection into a URL-safe base64 string. */
export function encodeCollection(col: SharedCollection): string {
  const json = JSON.stringify({
    v: 1,
    n: col.name,
    a: col.assetIds,
    t: col.createdAt,
    m: col.note ?? "",
  });
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a share code back into a collection stub (id not preserved). */
export function decodeCollection(code: string): Omit<SharedCollection, "id"> | null {
  try {
    const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(padded)))
      : Buffer.from(padded, "base64").toString("utf8");
    const p = JSON.parse(json);
    if (!p || !Array.isArray(p.a)) return null;
    return {
      name: String(p.n ?? "استيراد مشاركة"),
      assetIds: p.a.map(String),
      createdAt: Number(p.t) || Date.now(),
      note: p.m ? String(p.m) : undefined,
    };
  } catch {
    return null;
  }
}

export async function importCode(code: string): Promise<SharedCollection | null> {
  const stub = decodeCollection(code);
  if (!stub) return null;
  return createCollection(stub.name, stub.assetIds, stub.note);
}
