// Local-only photo state storage via Dexie/IndexedDB.
// Never sent to any server — pure client-side metadata.
import Dexie, { type Table } from "dexie";
import type { ExifData } from "./exif";

export interface PhotoState {
  id: string;
  favorite?: boolean;
  archived?: boolean;
  trashedAt?: number; // epoch ms; presence = in trash
  exif?: ExifData;
  sourceName?: string; // original file name if imported locally
  importedAt?: number;
}

class PhotoDatabase extends Dexie {
  states!: Table<PhotoState, string>;

  constructor() {
    super("localgallery-pro");
    this.version(1).stores({
      states: "id, favorite, archived, trashedAt",
    });
    // v2: keep same primary index; exif/source stored inside record.
    this.version(2).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
    });
  }
}

export const photoDb = new PhotoDatabase();

export async function setPhotoStates(
  ids: string[],
  patch: Partial<PhotoState>,
) {
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
