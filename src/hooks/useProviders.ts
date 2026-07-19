import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type ProviderConfig, type ProviderKind } from "@/lib/photoDb";

export function useProviders() {
  const [providers, setProviders] = useState<Map<ProviderKind, ProviderConfig>>(
    new Map(),
  );
  const [active, setActive] = useState<ProviderKind | null>(null);

  useEffect(() => {
    const s1 = liveQuery(() => photoDb.providers.toArray()).subscribe({
      next: (all) => setProviders(new Map(all.map((p) => [p.kind, p]))),
    });
    const s2 = liveQuery(() => photoDb.kv.get("activeProvider")).subscribe({
      next: (v) => setActive(((v?.value as ProviderKind) ?? null)),
    });
    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
    };
  }, []);

  return {
    providers,
    active,
    activeConfig: active ? providers.get(active) ?? null : null,
  };
}
