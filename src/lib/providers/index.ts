import { photoDb, type MediaAsset, type ProviderConfig, type ProviderKind } from "@/lib/photoDb";
import { extractExif } from "@/lib/exif";
import { telegramFileUrl, telegramGetFilePath, telegramSendDocument } from "./telegram";
import { localServerUpload } from "./localServer";

export async function saveProviderConfig(cfg: ProviderConfig) {
  await photoDb.providers.put(cfg);
}

export async function setActiveProvider(kind: ProviderKind | null) {
  if (kind === null) await photoDb.kv.delete("activeProvider");
  else await photoDb.kv.put({ key: "activeProvider", value: kind });
}

export async function getActiveProviderKind(): Promise<ProviderKind | null> {
  const v = await photoDb.kv.get("activeProvider");
  return (v?.value as ProviderKind | undefined) ?? null;
}

function newId() {
  return `asset-${crypto.randomUUID()}`;
}

export async function uploadFileToActiveProvider(file: File): Promise<MediaAsset> {
  const activeKind = await getActiveProviderKind();
  if (!activeKind) throw new Error("لم تختر مزود تخزين نشط بعد");
  const cfg = await photoDb.providers.get(activeKind);
  if (!cfg || !cfg.configured) throw new Error("مزود التخزين غير مكتمل الإعداد");

  const exif = await extractExif(file);
  const takenAt = exif.dateTaken ?? file.lastModified ?? Date.now();
  const baseAsset: Omit<MediaAsset, "provider" | "telegram" | "local" | "fs"> = {
    id: newId(),
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
    width: exif.width,
    height: exif.height,
    date: takenAt,
    createdAt: Date.now(),
    exif,
  };

  let asset: MediaAsset;
  if (activeKind === "telegram") {
    if (!cfg.botToken || !cfg.chatId) throw new Error("إعدادات تيليجرام ناقصة");
    const res = await telegramSendDocument(cfg.botToken, cfg.chatId, file);
    asset = {
      ...baseAsset,
      provider: "telegram",
      width: baseAsset.width ?? res.width,
      height: baseAsset.height ?? res.height,
      telegram: { fileId: res.fileId, messageId: res.messageId },
    };
  } else if (activeKind === "localServer") {
    if (!cfg.baseUrl) throw new Error("عنوان الخادم المحلي غير محدد");
    const res = await localServerUpload(cfg.baseUrl, file);
    asset = {
      ...baseAsset,
      provider: "localServer",
      local: { url: res.url, path: res.path },
    };
  } else {
    throw new Error("مزود File System غير مفعل في هذه المرحلة");
  }

  await photoDb.assets.put(asset);
  return asset;
}

// --- URL resolution with in-memory cache ---------------------------------
const urlCache = new Map<string, Promise<string>>();

export function resolveAssetUrl(
  asset: MediaAsset,
  cfg: ProviderConfig | undefined,
): Promise<string> {
  const key = asset.id;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const p = (async () => {
    if (asset.provider === "localServer") {
      return asset.local!.url;
    }
    if (asset.provider === "telegram") {
      if (!cfg?.botToken) throw new Error("توكن تيليجرام مفقود");
      let path = asset.telegram?.filePath;
      if (!path) {
        path = await telegramGetFilePath(cfg.botToken, asset.telegram!.fileId);
        // cache the resolved path back on the record for next session
        await photoDb.assets.update(asset.id, {
          telegram: { ...asset.telegram!, filePath: path },
        });
      }
      return telegramFileUrl(cfg.botToken, path);
    }
    throw new Error("مزود غير مدعوم");
  })();

  urlCache.set(key, p);
  p.catch(() => urlCache.delete(key));
  return p;
}
