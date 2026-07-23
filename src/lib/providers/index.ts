import { photoDb, type ProviderConfig, type ProviderKind } from "@/lib/photoDb";

export async function saveProviderConfig(cfg: ProviderConfig) {
  await photoDb.providers.put(cfg);
}

export async function getTelegramConfig(): Promise<ProviderConfig | undefined> {
  return photoDb.providers.get("telegram");
}

export async function setActiveProvider(kind: ProviderKind | null) {
  if (kind === null) await photoDb.kv.delete("activeProvider");
  else await photoDb.kv.put({ key: "activeProvider", value: kind });
}
