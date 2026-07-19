// Local sharing utilities: download an album as a ZIP, or forward to
// its bound Telegram forum topic. No third-party cloud is involved.
import JSZip from "jszip";
import type { MediaAsset, ProviderConfig } from "./photoDb";
import { resolveAssetUrl } from "./providers";
import { telegramSendDocument } from "./providers/telegram";


async function fetchAssetBlob(
  asset: MediaAsset,
  providers: Map<string, ProviderConfig>,
): Promise<Blob> {
  const cfg = providers.get(asset.provider);
  const url = await resolveAssetUrl(asset, cfg);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`تعذّر جلب ${asset.name}`);
  return r.blob();
}

export interface ShareProgress {
  index: number;
  total: number;
  name: string;
}

export async function downloadAlbumZip(
  albumName: string,
  assets: MediaAsset[],
  providers: Map<string, ProviderConfig>,
  onProgress?: (p: ShareProgress) => void,
) {
  const zip = new JSZip();
  const seen = new Map<string, number>();
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    onProgress?.({ index: i + 1, total: assets.length, name: a.name });
    let name = a.name || `${a.id}.bin`;
    const count = seen.get(name) ?? 0;
    if (count > 0) {
      const dot = name.lastIndexOf(".");
      name = dot > 0
        ? `${name.slice(0, dot)}_${count}${name.slice(dot)}`
        : `${name}_${count}`;
    }
    seen.set(a.name, count + 1);
    try {
      const blob = await fetchAssetBlob(a, providers);
      zip.file(name, blob);
    } catch {
      // skip unreadable asset — keep going
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${albumName.replace(/[\\/:*?"<>|]/g, "_")}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface TelegramShareOptions {
  botToken: string;
  chatId: string;
  topicId?: number;
  uploaderName?: string;
}

export async function shareAlbumToTelegram(
  albumName: string,
  assets: MediaAsset[],
  providers: Map<string, ProviderConfig>,
  opts: TelegramShareOptions,
  onProgress?: (p: ShareProgress) => void,
) {
  const header = opts.uploaderName
    ? `📁 ${albumName} — بواسطة ${opts.uploaderName}`
    : `📁 ${albumName}`;
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    onProgress?.({ index: i + 1, total: assets.length, name: a.name });
    const blob = await fetchAssetBlob(a, providers);
    const file = new File([blob], a.name, { type: a.mime });
    const caption = `${header}\n${a.name}`;
    const isImage = a.mime.startsWith("image/") && a.kind !== "video";
    if (isImage && blob.size < 10 * 1024 * 1024) {
      await telegramSendPhoto(opts.botToken, opts.chatId, file, {
        messageThreadId: opts.topicId,
        caption,
      });
    } else {
      await telegramSendDocument(opts.botToken, opts.chatId, file, {
        messageThreadId: opts.topicId,
        caption,
      });
    }
  }
}
