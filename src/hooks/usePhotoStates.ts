import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, setPhotoStates, type PhotoState } from "@/lib/photoDb";

export function usePhotoStates() {
  const [states, setStates] = useState<Map<string, PhotoState>>(new Map());

  useEffect(() => {
    const sub = liveQuery(() => photoDb.states.toArray()).subscribe({
      next: (all) => setStates(new Map(all.map((s) => [s.id, s]))),
      error: (err) => console.error("photoStates liveQuery", err),
    });
    return () => sub.unsubscribe();
  }, []);

  return {
    states,
    setFavorite: (ids: string[], favorite: boolean) =>
      setPhotoStates(ids, { favorite }),
    setArchived: (ids: string[], archived: boolean) =>
      setPhotoStates(ids, { archived }),
    trash: (ids: string[]) => setPhotoStates(ids, { trashedAt: Date.now() }),
    restore: (ids: string[]) =>
      setPhotoStates(ids, { trashedAt: undefined as unknown as number }),
  };
}
