import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type MediaAsset, type ProviderKind } from "@/lib/photoDb";

type Filter =
  | { kind: "unsynced-device" }
  | { kind: "telegram-remote" }
  | { kind: "provider"; provider: ProviderKind }
  | { kind: "all" };

export function useMediaAssets(filter: Filter = { kind: "all" }): MediaAsset[] {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  useEffect(() => {
    const sub = liveQuery(async () => {
      const rows = await photoDb.assets.orderBy("date").reverse().toArray();
      switch (filter.kind) {
        case "unsynced-device":
          return rows.filter((r) => r.provider === "device" && r.syncedAt == null);
        case "telegram-remote":
          return rows.filter((r) => r.provider === "telegram-remote");
        case "provider":
          return rows.filter((r) => r.provider === filter.provider);
        default:
          return rows;
      }
    }).subscribe({ next: setAssets });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.kind, (filter as { provider?: string }).provider]);
  return assets;
}
