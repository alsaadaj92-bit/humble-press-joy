import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb } from "@/lib/photoDb";

/** Live map of albumId -> Set<assetId> for quick membership lookups. */
export function useAlbumMemberIndex() {
  const [index, setIndex] = useState<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    const sub = liveQuery(() => photoDb.albumMembers.toArray()).subscribe({
      next: (rows) => {
        const m = new Map<string, Set<string>>();
        for (const r of rows) {
          let s = m.get(r.albumId);
          if (!s) {
            s = new Set();
            m.set(r.albumId, s);
          }
          s.add(r.assetId);
        }
        setIndex(m);
      },
    });
    return () => sub.unsubscribe();
  }, []);
  return index;
}
