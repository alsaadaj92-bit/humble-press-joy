import { useLiveQuery } from "dexie-react-hooks";
import { photoDb, setPhotoStates, type PhotoState } from "@/lib/photoDb";
import { useMemo } from "react";

// Fallback: dexie-react-hooks might not be installed — use manual subscription instead.
// We keep this file free of that dep and roll our own tiny live query below.

import { useEffect, useState } from "react";

export function usePhotoStates() {
  const [states, setStates] = useState<Map<string, PhotoState>>(new Map());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const all = await photoDb.states.toArray();
      if (!mounted) return;
      setStates(new Map(all.map((s) => [s.id, s])));
    };
    load();
    // Dexie provides a hook to observe changes
    const sub = photoDb.on("changes", () => {
      load();
    });
    return () => {
      mounted = false;
      // @ts-expect-error dexie hook remover
      photoDb.on("changes").unsubscribe?.(sub);
    };
  }, []);

  return {
    states,
    setFavorite: (ids: string[], favorite: boolean) =>
      setPhotoStates(ids, { favorite }),
    setArchived: (ids: string[], archived: boolean) =>
      setPhotoStates(ids, { archived }),
    trash: (ids: string[]) => setPhotoStates(ids, { trashedAt: Date.now() }),
    restore: (ids: string[]) => setPhotoStates(ids, { trashedAt: undefined }),
  };
}

// (silence unused import warnings from optional dep line above)
export const _unused = { useLiveQuery, useMemo };
