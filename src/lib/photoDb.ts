// Local-only photo state storage via Dexie/IndexedDB.
// Never sent to any server — pure client-side metadata.
import Dexie, { type Table } from "dexie";

export interface PhotoState {
  id: string;
  favorite?: boolean;
  archived?: boolean;
  trashedAt?: number; // epoch ms; presence = in trash
}

class PhotoDatabase extends Dexie {
  states!: Table<PhotoState, string>;

  constructor() {
    super("localgallery-pro");
    this.version(1).stores({
      states: "id, favorite, archived, trashedAt",
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
