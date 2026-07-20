// Wraps @capacitor-community/media so the app can read the phone's full gallery
// (like Google Photos does). Web/PWA has no equivalent — returns [] there.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import type { MediaAsset } from "./photoDb";
import { photoDb } from "./photoDb";

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

const Media = registerPlugin<MediaPluginShape>("Media");

export const canScanDeviceGallery = () => Capacitor.isNativePlatform();

/** Read every photo + video from the phone's system gallery. */
export async function scanDeviceGallery(
  onProgress?: (done: number, total: number) => void,
  max = 5000,
): Promise<number> {
  if (!canScanDeviceGallery()) return 0;

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
      ...(isVideo ? { duration: m.duration } : {}),
      ...(m.location?.latitude && m.location?.longitude
        ? { exif: { gps: { lat: m.location.latitude, lon: m.location.longitude }, dateTaken } }
        : {}),
      deviceIdentifier: m.identifier,
    } as MediaAsset;

    await photoDb.assets.put(asset);
    inserted++;
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
