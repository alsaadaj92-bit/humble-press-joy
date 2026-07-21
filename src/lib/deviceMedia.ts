// Wraps @capacitor-community/media so the app can read the phone's full gallery
// (like Google Photos does). Web/PWA has no equivalent — returns [] there.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import type { MediaAsset } from "./photoDb";
import { photoDb } from "./photoDb";
import { requestGalleryPermission } from "./native";
import { logDiag } from "./diagnostics";

interface DeviceMediaItem {
  identifier: string;
  data: string; // base64 thumbnail (JPEG)
  creationDate: string;
  fullWidth: number;
  fullHeight: number;
  duration?: number;
  location?: { latitude?: number; longitude?: number };
}
interface MediaPluginShape {
  getMedias(opts: {
    quantity?: number;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    thumbnailQuality?: number;
    types?: "photos" | "videos" | "all";
  }): Promise<{ medias: DeviceMediaItem[] }>;
  getMediaByIdentifier?(opts: { identifier: string }): Promise<{ path: string }>;
}

interface LocalGalleryMediaItem {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  date: number;
  duration?: number;
  uri?: string;
  path?: string;
  thumbnail?: string;
  latitude?: number;
  longitude?: number;
}

interface LocalGalleryMediaPlugin {
  getDeviceMedia(opts?: { limit?: number; offset?: number; thumbnailSize?: number }): Promise<{
    items: LocalGalleryMediaItem[];
    total?: number;
    hasMore?: boolean;
  }>;
}

const Media = registerPlugin<MediaPluginShape>("Media");
const LocalGalleryMedia = registerPlugin<LocalGalleryMediaPlugin>("LocalGalleryMedia");

export const canScanDeviceGallery = () => Capacitor.isNativePlatform();

/** Read every photo + video from the phone's system gallery. */
export async function scanDeviceGallery(
  onProgress?: (done: number, total: number) => void,
  max = 50_000,
): Promise<number> {
  if (!canScanDeviceGallery()) return 0;
  const platform = Capacitor.getPlatform();
  logDiag("info", "scan", `starting device gallery scan (${platform})`);
  try {
    if (platform === "android") {
      const granted = await requestGalleryPermission().catch((e) => {
        logDiag("warn", "scan", "gallery permission request failed", e);
        return false;
      });
      if (!granted) logDiag("warn", "scan", "gallery permission not granted — scan may be empty");
      const n = await scanAndroidGallery(onProgress, max);
      logDiag("info", "scan", `scan complete — inserted ${n} new assets`);
      return n;
    }

    const { medias } = await Media.getMedias({
      quantity: max,
      thumbnailWidth: 320,
      thumbnailHeight: 320,
      thumbnailQuality: 70,
      types: "all",
    });

    const total = medias.length;
    let inserted = 0;

    for (let i = 0; i < medias.length; i++) {
      const m = medias[i];
      onProgress?.(i, total);

      const id = `device:${m.identifier}`;
      const existing = await photoDb.assets.get(id);
      if (existing) continue;

      const isVideo = typeof m.duration === "number" && m.duration > 0;
      const dateTaken = new Date(m.creationDate).getTime() || Date.now();

      const asset: MediaAsset = {
        id,
        provider: "device",
        name: m.identifier.split("/").pop() ?? m.identifier,
        size: 0,
        mime: isVideo ? "video/*" : "image/*",
        width: m.fullWidth,
        height: m.fullHeight,
        date: dateTaken,
        createdAt: Date.now(),
        kind: isVideo ? "video" : "image",
        posterDataUrl: `data:image/jpeg;base64,${m.data}`,
        deviceIdentifier: m.identifier,
        ...(isVideo ? { duration: m.duration } : {}),
        ...(m.location?.latitude && m.location?.longitude
          ? { exif: { gps: { lat: m.location.latitude, lon: m.location.longitude }, dateTaken } }
          : {}),
      };

      await photoDb.assets.put(asset);
      inserted++;
    }

    onProgress?.(total, total);
    logDiag("info", "scan", `scan complete — inserted ${inserted} new assets`);
    return inserted;
  } catch (err) {
    logDiag("error", "scan", "device gallery scan failed", err);
    throw err;
  }
}

async function scanAndroidGallery(
  onProgress?: (done: number, total: number) => void,
  max = 50_000,
): Promise<number> {
  const PAGE = 500;
  let offset = 0;
  let inserted = 0;
  let total = 0;

  while (offset < max) {
    const res = await LocalGalleryMedia.getDeviceMedia({
      limit: Math.min(PAGE, max - offset),
      offset,
      thumbnailSize: 360,
    });
    const items = res.items ?? [];
    total = res.total ?? Math.max(total, offset + items.length);
    onProgress?.(offset, total);

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const id = `device:${m.id}`;
      const existing = await photoDb.assets.get(id);
      if (!existing) {
        const isVideo = m.mime.startsWith("video/") || !!m.duration;
        const asset: MediaAsset = {
          id,
          provider: "device",
          name: m.name || m.id,
          size: m.size || 0,
          mime: m.mime || (isVideo ? "video/*" : "image/*"),
          width: m.width || undefined,
          height: m.height || undefined,
          date: m.date || Date.now(),
          createdAt: Date.now(),
          kind: isVideo ? "video" : "image",
          posterDataUrl: m.thumbnail,
          deviceIdentifier: m.uri ?? m.path ?? m.id,
          ...(isVideo ? { duration: m.duration } : {}),
          ...(m.latitude && m.longitude
            ? { exif: { gps: { lat: m.latitude, lon: m.longitude }, dateTaken: m.date } }
            : {}),
        };
        await photoDb.assets.put(asset);
        inserted++;
      }
      onProgress?.(offset + i + 1, total);
    }

    offset += items.length;
    if (!items.length || !res.hasMore || offset >= total) break;
  }

  onProgress?.(total, total);
  return inserted;
}

/** Resolve a device-media identifier to a full-quality file URI for upload. */
export async function resolveDeviceMedia(identifier: string): Promise<string | null> {
  if (!canScanDeviceGallery()) return null;
  if (Capacitor.getPlatform() === "android") {
    // On Android the identifier is already the file path.
    try {
      const { uri } = await Filesystem.stat({ path: identifier });
      return uri;
    } catch {
      return identifier;
    }
  }
  const res = await Media.getMediaByIdentifier?.({ identifier });
  return res?.path ?? null;
}
