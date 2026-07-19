import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type MediaAsset } from "@/lib/photoDb";

export function useMediaAssets() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  useEffect(() => {
    const sub = liveQuery(() =>
      photoDb.assets.orderBy("date").reverse().toArray(),
    ).subscribe({ next: setAssets });
    return () => sub.unsubscribe();
  }, []);
  return assets;
}
