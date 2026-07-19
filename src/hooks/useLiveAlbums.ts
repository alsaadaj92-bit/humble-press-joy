import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb } from "@/lib/photoDb";
import {
  DEFAULT_LIVE_ALBUMS,
  saveLiveAlbums,
  type LiveAlbum,
} from "@/lib/liveAlbums";

const KV_KEY = "live-albums.v1";

export function useLiveAlbums() {
  const [albums, setAlbums] = useState<LiveAlbum[]>([]);
  useEffect(() => {
    const sub = liveQuery(() => photoDb.kv.get(KV_KEY)).subscribe({
      next: (row) => {
        if (!row) return setAlbums(DEFAULT_LIVE_ALBUMS());
        try {
          const parsed = JSON.parse(row.value) as LiveAlbum[];
          setAlbums(Array.isArray(parsed) ? parsed : DEFAULT_LIVE_ALBUMS());
        } catch {
          setAlbums(DEFAULT_LIVE_ALBUMS());
        }
      },
    });
    return () => sub.unsubscribe();
  }, []);

  return {
    albums,
    save: (next: LiveAlbum[]) => saveLiveAlbums(next),
  };
}
