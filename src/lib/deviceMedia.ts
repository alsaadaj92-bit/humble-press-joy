// Device gallery import — pivoted to use Capacitor's Camera.pickImages which
// on Android correctly requests READ_MEDIA_IMAGES / READ_MEDIA_VISUAL_USER_SELECTED
// and returns real file URIs we can convert to blobs. The previous approach
// depended on a custom "LocalGalleryMedia" native plugin that was never
// implemented, so scans silently failed.
//
// Users get the OS multi-select sheet ("Select all" works there) and every
// picked photo/video is inserted into IndexedDB as a MediaAsset with its
// original blob — meaning it shows up in the grid immediately, offline.
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { photoDb, type MediaAsset } from "./photoDb";
import { extractExif } from "./exif";
import { extractVideoMeta, isVideoMime } from "./video";
import { requestGalleryPermission } from "./native";
import { logNative, logIdb, mark } from "./diagnostics";

export const canScanDeviceGallery = () => Capacitor.isNativePlatform();

async function uriToFile(webPath: string, fallbackName: string): Promise<File | null> {
  try {
    const res = await fetch(webPath);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
    const name = fallbackName.includes(".") ? fallbackName : `${fallbackName}.${ext}`;
    return new File([blob], name, { type: blob.type || `image/${ext}`, lastModified: Date.now() });
  } catch (e) {
    logNative("scan", "uriToFile failed", { webPath, err: String(e) });
    return null;
  }
}

/**
 * Opens the OS gallery multi-select. `limit: 0` means unlimited on Android/iOS.
 * Every selected item is imported as a MediaAsset with its blob persisted in
 * IndexedDB, so it renders in the gallery immediately and survives reloads.
 */
export async function scanDeviceGallery(
  onProgress?: (done: number, total: number) => void,
  max = 0,
): Promise<number> {
  if (!canScanDeviceGallery()) return 0;
  const t = mark();
  logNative("scan", "device gallery import start");

  const granted = await requestGalleryPermission().catch(() => false);
  if (!granted) {
    logNative("scan", "gallery permission not granted — abort");
    return 0;
  }

  let picked: { webPath?: string; format?: string; path?: string }[] = [];
  try {
    const res = await Camera.pickImages({ quality: 92, limit: max });
    picked = res.photos ?? [];
  } catch (e) {
    logNative("scan", "pickImages failed", e);
    return 0;
  }

  const total = picked.length;
  logNative("scan", `user selected ${total} items`);
  let inserted = 0;

  for (let i = 0; i < picked.length; i++) {
    const p = picked[i];
    onProgress?.(i, total);
    if (!p.webPath) continue;
    const name = p.path?.split("/").pop() ?? `photo-${Date.now()}-${i}.${p.format ?? "jpg"}`;
    const file = await uriToFile(p.webPath, name);
    if (!file) continue;

    // De-dupe by name+size+mtime combo — same rule as the manual uploader.
    const id = `device-${file.size}-${file.lastModified}-${file.name}`;
    if (await photoDb.assets.get(id)) continue;

    const isVideo = isVideoMime(file.type);
    let width: number | undefined;
    let height: number | undefined;
    let dateTaken = file.lastModified || Date.now();
    let posterDataUrl: string | undefined;
    let duration: number | undefined;
    let exif: Awaited<ReturnType<typeof extractExif>> | undefined;

    try {
      if (isVideo) {
        const m = await extractVideoMeta(file);
        width = m.width;
        height = m.height;
        duration = m.duration;
        posterDataUrl = m.posterDataUrl;
      } else {
        exif = await extractExif(file);
        width = exif.width;
        height = exif.height;
        dateTaken = exif.dateTaken ?? dateTaken;
      }
    } catch {
      /* ignore metadata failures — blob still shows */
    }

    const asset: MediaAsset = {
      id,
      provider: "device",
      name: file.name,
      size: file.size,
      mime: file.type || (isVideo ? "video/*" : "image/*"),
      width,
      height,
      date: dateTaken,
      createdAt: Date.now(),
      kind: isVideo ? "video" : "image",
      blob: file,
      ...(posterDataUrl ? { posterDataUrl } : {}),
      ...(duration ? { duration } : {}),
      ...(exif ? { exif } : {}),
    };

    await photoDb.assets.put(asset);
    inserted++;
  }

  onProgress?.(total, total);
  logNative("scan", "import complete", { ms: t(), inserted, total });
  if (inserted > 0) logIdb("assets", `inserted ${inserted} device assets`);
  return inserted;
}

/** No-op on this build — device assets already carry their blob. */
export async function resolveDeviceMedia(): Promise<string | null> {
  return null;
}
