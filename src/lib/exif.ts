// Local-only EXIF extraction. Runs entirely in the browser via exifr.
// No file bytes ever leave the device.
import exifr from "exifr";

export interface ExifData {
  dateTaken?: number; // epoch ms
  camera?: string; // "Make Model"
  lens?: string;
  orientation?: number;
  width?: number;
  height?: number;
  iso?: number;
  fNumber?: number;
  exposureTime?: number; // seconds
  focalLength?: number; // mm
  gps?: { lat: number; lon: number };
}

const PICKED = [
  "DateTimeOriginal",
  "CreateDate",
  "ModifyDate",
  "Make",
  "Model",
  "LensModel",
  "LensMake",
  "Orientation",
  "ExifImageWidth",
  "ExifImageHeight",
  "PixelXDimension",
  "PixelYDimension",
  "ISO",
  "FNumber",
  "ExposureTime",
  "FocalLength",
  "GPSLatitude",
  "GPSLongitude",
];

export async function extractExif(file: File | Blob): Promise<ExifData> {
  try {
    const raw = await exifr.parse(file, {
      pick: PICKED,
      gps: true,
      translateValues: false,
      reviveValues: true,
    });
    if (!raw) return {};

    const dateTaken =
      raw.DateTimeOriginal instanceof Date
        ? raw.DateTimeOriginal.getTime()
        : raw.CreateDate instanceof Date
          ? raw.CreateDate.getTime()
          : raw.ModifyDate instanceof Date
            ? raw.ModifyDate.getTime()
            : undefined;

    const camera = [raw.Make, raw.Model]
      .filter(Boolean)
      .map((s: string) => String(s).trim())
      .join(" ")
      .trim() || undefined;

    const lens =
      raw.LensModel || raw.LensMake
        ? [raw.LensMake, raw.LensModel].filter(Boolean).join(" ").trim()
        : undefined;

    const gps =
      typeof raw.latitude === "number" && typeof raw.longitude === "number"
        ? { lat: raw.latitude, lon: raw.longitude }
        : undefined;

    return {
      dateTaken,
      camera,
      lens,
      orientation: raw.Orientation,
      width: raw.ExifImageWidth ?? raw.PixelXDimension,
      height: raw.ExifImageHeight ?? raw.PixelYDimension,
      iso: raw.ISO,
      fNumber: raw.FNumber,
      exposureTime: raw.ExposureTime,
      focalLength: raw.FocalLength,
      gps,
    };
  } catch (err) {
    console.warn("exif parse failed", err);
    return {};
  }
}

const ORIENTATION_LABELS: Record<number, string> = {
  1: "أفقي طبيعي",
  2: "معكوس أفقياً",
  3: "دوران 180°",
  4: "معكوس رأسياً",
  5: "دوران 90° يسار + معكوس",
  6: "دوران 90° يمين",
  7: "دوران 90° يمين + معكوس",
  8: "دوران 90° يسار",
};

export function orientationLabel(o?: number) {
  if (!o) return undefined;
  return ORIENTATION_LABELS[o] ?? `#${o}`;
}

export function formatExposure(s?: number) {
  if (!s) return undefined;
  if (s >= 1) return `${s.toFixed(1)}s`;
  return `1/${Math.round(1 / s)}s`;
}
