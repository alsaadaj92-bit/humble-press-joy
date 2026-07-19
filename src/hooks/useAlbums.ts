import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type Album } from "@/lib/photoDb";

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  useEffect(() => {
    const s = liveQuery(() =>
      photoDb.albums.orderBy("updatedAt").reverse().toArray(),
    ).subscribe({ next: setAlbums });
    return () => s.unsubscribe();
  }, []);
  return albums;
}
