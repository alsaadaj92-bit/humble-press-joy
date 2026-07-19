// Local-only photo state storage via Dexie/IndexedDB.
// Never sent to any server — pure client-side metadata + provider configs.
import Dexie, { type Table } from "dexie";
import type { ExifData } from "./exif";

export interface PhotoState {
  id: string;
  favorite?: boolean;
  archived?: boolean;
  trashedAt?: number;
  exif?: ExifData;
  sourceName?: string;
  importedAt?: number;
}

export type ProviderKind = "telegram" | "localServer" | "fileSystem";

export interface ProviderConfig {
  kind: ProviderKind;
  configured: boolean;
  // Telegram
  botToken?: string;
  chatId?: string;
  // Local Node.js server
  baseUrl?: string;
  // File System Access (handle stored separately in memory or via IDB serialization)
  fsRootName?: string;
}

export interface MediaAsset {
  id: string;
  provider: ProviderKind;
  name: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
  date: number;       // taken date, else uploaded date
  createdAt: number;  // uploaded/local timestamp
  exif?: ExifData;
  telegram?: { fileId: string; messageId?: number; filePath?: string };
  local?: { url: string; path: string };
  fs?: { path: string };
}

export interface KV {
  key: string;
  value: string;
}

class PhotoDatabase extends Dexie {
  states!: Table<PhotoState, string>;
  providers!: Table<ProviderConfig, ProviderKind>;
  assets!: Table<MediaAsset, string>;
  kv!: Table<KV, string>;

  constructor() {
    super("localgallery-pro");
    this.version(1).stores({ states: "id, favorite, archived, trashedAt" });
    this.version(2).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
    });
    this.version(3).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
    });
  }
}

export const photoDb = new PhotoDatabase();

export async function setPhotoStates(ids: string[], patch: Partial<PhotoState>) {
  await photoDb.transaction("rw", photoDb.states, async () => {
    for (const id of ids) {
      const existing = (await photoDb.states.get(id)) ?? { id };
      await photoDb.states.put({ ...existing, ...patch, id });
    }
  });
}

export function localPhotoId(file: { name: string; size: number; lastModified: number }) {
  return `local-${file.size}-${file.lastModified}-${file.name}`;
}
