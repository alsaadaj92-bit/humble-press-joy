// Native bridge — thin wrapper over Capacitor plugins with web fallbacks.
// All checks are runtime-safe: the app still works in a browser (web mode).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource, type Photo } from "@capacitor/camera";
import { LocalNotifications, type PermissionStatus as LNStatus } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"

type NativePermissionState = "granted" | "denied" | "prompt" | "prompt-with-rationale" | "unknown";

interface LocalGalleryMediaPlugin {
  checkGalleryPermissions(): Promise<{ media: NativePermissionState }>;
  requestGalleryPermissions(): Promise<{ media: NativePermissionState }>;
}

const LocalGalleryMedia = registerPlugin<LocalGalleryMediaPlugin>("LocalGalleryMedia");

// ------- Camera --------------------------------------------------------------
async function photoToFile(p: Photo, prefix: string): Promise<File | null> {
  if (!p.webPath) return null;
  const res = await fetch(p.webPath);
  const blob = await res.blob();
  const ext = p.format ?? "jpg";
  const name = `${prefix}-${Date.now()}.${ext}`;
  return new File([blob], name, { type: blob.type || `image/${ext}`, lastModified: Date.now() });
}

export async function takePhoto(): Promise<File | null> {
  if (!isNative()) return null;
  const photo = await Camera.getPhoto({
    quality: 92,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
  });
  return photoToFile(photo, "camera");
}

export async function pickFromGallery(limit = 0): Promise<File[]> {
  if (!isNative()) return [];
  // limit: 0 = unlimited on Android/iOS (Capacitor Camera v5+)
  const { photos } = await Camera.pickImages({ quality: 92, limit });
  const files: File[] = [];
  for (const p of photos) {
    const f = await photoToFile(p as unknown as Photo, "picked");
    if (f) files.push(f);
  }
  return files;
}

export async function requestCameraPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const res = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
  return res.camera === "granted" || res.photos === "granted";
}

export async function checkCameraPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (!isNative()) return "unknown";
  const res = await Camera.checkPermissions();
  return (res.camera as never) ?? "prompt";
}

// ------- Full device gallery --------------------------------------------------
export async function requestGalleryPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await LocalGalleryMedia.requestGalleryPermissions();
    return res.media === "granted";
  } catch {
    const res = await Camera.requestPermissions({ permissions: ["photos"] });
    return res.photos === "granted";
  }
}

export async function checkGalleryPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (!isNative()) return "unknown";
  try {
    const res = await LocalGalleryMedia.checkGalleryPermissions();
    return res.media === "prompt-with-rationale" ? "prompt" : (res.media as "granted" | "denied" | "prompt");
  } catch {
    try {
      const res = await Camera.checkPermissions();
      return (res.photos as never) ?? "prompt";
    } catch {
      return "unknown";
    }
  }
}

// ------- Local notifications --------------------------------------------------
export async function requestNotifPermission(): Promise<boolean> {
  if (!isNative()) return "Notification" in globalThis
    ? (await Notification.requestPermission()) === "granted"
    : false;
  const res: LNStatus = await LocalNotifications.requestPermissions();
  return res.display === "granted";
}

export async function checkNotifPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (!isNative()) {
    if (!("Notification" in globalThis)) return "unknown";
    return Notification.permission as "granted" | "denied" | "prompt";
  }
  const res = await LocalNotifications.checkPermissions();
  return (res.display as never) ?? "prompt";
}

let notifCounter = 1;
export async function notify(title: string, body: string) {
  try {
    if (isNative()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifCounter++,
            title,
            body,
            smallIcon: "ic_stat_icon_config_sample",
            schedule: { at: new Date(Date.now() + 100) },
          },
        ],
      });
    } else if ("Notification" in globalThis && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // silent
  }
}

// ------- Geolocation ---------------------------------------------------------
export async function requestLocationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const res = await Geolocation.requestPermissions();
  return res.location === "granted";
}

export async function checkLocationPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (!isNative()) return "unknown";
  const res = await Geolocation.checkPermissions();
  return (res.location as never) ?? "prompt";
}

// ------- Native share --------------------------------------------------------
export async function nativeShareText(title: string, text: string, url?: string) {
  if (!isNative()) {
    if ("share" in navigator) {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title, text, url });
      return true;
    }
    return false;
  }
  await Share.share({ title, text, url });
  return true;
}

// ------- Save file to device (Downloads-like) --------------------------------
export async function saveBlobToDevice(name: string, blob: Blob): Promise<string | null> {
  if (!isNative()) return null;
  const buf = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await Filesystem.writeFile({
    path: name,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });
  return res.uri;
}

// ------- Haptics -------------------------------------------------------------
export async function tap(style: "light" | "medium" | "heavy" = "light") {
  if (!isNative()) return;
  try {
    await Haptics.impact({
      style:
        style === "heavy" ? ImpactStyle.Heavy : style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch { /* noop */ }
}

// ------- Preferences (native-safe KV) ---------------------------------------
export async function prefGet(key: string): Promise<string | null> {
  if (!isNative()) return localStorage.getItem(key);
  const { value } = await Preferences.get({ key });
  return value;
}
export async function prefSet(key: string, value: string): Promise<void> {
  if (!isNative()) return localStorage.setItem(key, value);
  await Preferences.set({ key, value });
}
