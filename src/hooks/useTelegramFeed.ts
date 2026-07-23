import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type MediaAsset } from "@/lib/photoDb";
import {
  telegramGetUpdates,
  telegramGetFilePath,
  telegramFileUrl,
} from "@/lib/providers/telegram";
import { logNative } from "@/lib/diagnostics";

const OFFSET_KEY = "tg:updates:offset";

interface TelegramMessagePhoto { file_id: string; width: number; height: number; file_size?: number }
interface TelegramMessageDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: { width: number; height: number };
}
interface TelegramMessageVideo {
  file_id: string;
  width: number;
  height: number;
  duration?: number;
  mime_type?: string;
  file_size?: number;
}
interface RawUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    photo?: TelegramMessagePhoto[];
    document?: TelegramMessageDocument;
    video?: TelegramMessageVideo;
    caption?: string;
  };
  channel_post?: RawUpdate["message"];
}

async function insertFromUpdate(u: RawUpdate) {
  const msg = u.message ?? u.channel_post;
  if (!msg) return;
  const date = (msg.date ?? Math.floor(Date.now() / 1000)) * 1000;

  const put = async (partial: Partial<MediaAsset> & { id: string; remoteFileId: string }) => {
    const syncedLocal = await photoDb.assets.where("remoteFileId").equals(partial.remoteFileId).first();
    if (syncedLocal) {
      const { id: _ignored, ...patch } = partial;
      await photoDb.assets.update(syncedLocal.id, {
        ...patch,
        provider: "telegram-remote",
        remoteMessageId: msg.message_id,
      });
      return;
    }
    const existing = await photoDb.assets.get(partial.id);
    if (existing) return;
    const asset: MediaAsset = {
      name: `tg-${partial.remoteFileId.slice(0, 12)}`,
      size: 0,
      mime: "image/jpeg",
      date,
      createdAt: Date.now(),
      provider: "telegram-remote",
      remoteMessageId: msg.message_id,
      ...partial,
    } as MediaAsset;
    await photoDb.assets.put(asset);
  };

  if (msg.photo?.length) {
    const largest = msg.photo[msg.photo.length - 1];
    await put({
      id: `tg-${largest.file_id}`,
      remoteFileId: largest.file_id,
      width: largest.width,
      height: largest.height,
      size: largest.file_size ?? 0,
      kind: "image",
      mime: "image/jpeg",
    });
  }
  if (msg.document && msg.document.mime_type?.startsWith("image/")) {
    await put({
      id: `tg-${msg.document.file_id}`,
      remoteFileId: msg.document.file_id,
      width: msg.document.thumb?.width,
      height: msg.document.thumb?.height,
      size: msg.document.file_size ?? 0,
      name: msg.document.file_name ?? `tg-${msg.document.file_id.slice(0, 8)}`,
      kind: "image",
      mime: msg.document.mime_type,
    });
  }
  if (msg.document && msg.document.mime_type?.startsWith("video/")) {
    await put({
      id: `tg-${msg.document.file_id}`,
      remoteFileId: msg.document.file_id,
      size: msg.document.file_size ?? 0,
      name: msg.document.file_name ?? `tg-${msg.document.file_id.slice(0, 8)}`,
      kind: "video",
      mime: msg.document.mime_type,
    });
  }
  if (msg.video) {
    await put({
      id: `tg-${msg.video.file_id}`,
      remoteFileId: msg.video.file_id,
      width: msg.video.width,
      height: msg.video.height,
      duration: msg.video.duration,
      size: msg.video.file_size ?? 0,
      kind: "video",
      mime: msg.video.mime_type ?? "video/mp4",
    });
  }
}

/**
 * Polls Telegram getUpdates on mount and every `intervalMs`. Persists the
 * last update_id in kv so we don't re-ingest on reload. Every image/video
 * message becomes a telegram-remote MediaAsset that the gallery can render.
 */
export function useTelegramFeed(enabled: boolean, intervalMs = 15000, trigger: number = 0) {
  const running = useRef(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const poll = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const cfg = await photoDb.providers.get("telegram");
        if (!cfg?.botToken) return;
        const offsetRaw = await photoDb.kv.get(OFFSET_KEY);
        const offset = offsetRaw?.value ? Number(offsetRaw.value) + 1 : undefined;
        const updates = (await telegramGetUpdates(cfg.botToken, offset)) as unknown as RawUpdate[];
        for (const u of updates) {
          await insertFromUpdate(u);
        }
        if (updates.length) {
          const maxId = Math.max(...updates.map((u) => u.update_id));
          await photoDb.kv.put({ key: OFFSET_KEY, value: String(maxId) });
        }
        setLastError(null);
        setLastPolledAt(Date.now());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLastError(msg);
        logNative("telegram-feed", msg, "warn");
      } finally {
        running.current = false;
      }
    };

    void poll();
    const id = window.setInterval(() => { if (!cancelled) void poll(); }, intervalMs);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [enabled, intervalMs, trigger]);

  return { lastError, lastPolledAt };
}

/** Resolve a full-size URL for a remote asset (getFile → file/bot). */
export async function resolveRemoteUrl(asset: MediaAsset): Promise<string | null> {
  if (!asset.remoteFileId) return null;
  const cfg = await photoDb.providers.get("telegram");
  if (!cfg?.botToken) return null;
  if (asset.remoteFilePath) return telegramFileUrl(cfg.botToken, asset.remoteFilePath);
  const path = await telegramGetFilePath(cfg.botToken, asset.remoteFileId);
  await photoDb.assets.update(asset.id, { remoteFilePath: path });
  return telegramFileUrl(cfg.botToken, path);
}

export function useRemoteAssetUrls(assets: MediaAsset[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = new Map(urls);
      let changed = false;
      for (const a of assets) {
        if (next.has(a.id)) continue;
        if (a.remoteFileId) {
          try {
            const url = await resolveRemoteUrl(a);
            if (cancelled) return;
            if (url) { next.set(a.id, url); changed = true; }
          } catch { /* skip */ }
          continue;
        }
        if (a.blob) {
          next.set(a.id, URL.createObjectURL(a.blob));
          changed = true;
        }
      }
      if (changed && !cancelled) setUrls(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);
  return urls;
}

export { insertFromUpdate as _insertFromUpdate };
