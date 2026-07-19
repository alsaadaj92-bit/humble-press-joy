// Local place clustering. Groups photos by rough geo grid cells and
// derives a human-readable region label from latitude/longitude bands.
// 100% offline — no reverse-geocoding service.

import type { MockPhoto } from "./mockPhotos";

export interface GeoPhoto extends MockPhoto {
  lat: number;
  lon: number;
}

export interface PlaceCluster {
  id: string;
  lat: number;   // centroid
  lon: number;   // centroid
  label: string;
  photos: GeoPhoto[];
}

/** Approximate continental / oceanic region from coordinates. */
export function regionLabel(lat: number, lon: number): string {
  // Poles
  if (lat > 66) return "المنطقة القطبية الشمالية";
  if (lat < -60) return "المنطقة القطبية الجنوبية";

  // Middle East (rough box)
  if (lat >= 12 && lat <= 42 && lon >= 25 && lon <= 63) return "الشرق الأوسط";
  // North Africa
  if (lat >= 15 && lat < 37 && lon >= -17 && lon < 35) return "شمال أفريقيا";
  // Sub-Saharan Africa
  if (lat >= -35 && lat < 15 && lon >= -20 && lon <= 52) return "أفريقيا";
  // Europe
  if (lat >= 36 && lat <= 71 && lon >= -25 && lon <= 45) return "أوروبا";
  // Russia / North Asia
  if (lat > 45 && lon > 45 && lon <= 180) return "شمال آسيا";
  // South Asia
  if (lat >= 5 && lat < 36 && lon > 63 && lon <= 97) return "جنوب آسيا";
  // East Asia
  if (lat >= 20 && lat <= 55 && lon > 97 && lon <= 150) return "شرق آسيا";
  // Southeast Asia / Oceania
  if (lat >= -10 && lat < 20 && lon > 92 && lon <= 145) return "جنوب شرق آسيا";
  if (lat < -10 && lon >= 110 && lon <= 180) return "أوقيانوسيا";
  // North America
  if (lat > 15 && lon >= -170 && lon < -50) return "أمريكا الشمالية";
  // South America
  if (lat <= 15 && lon >= -82 && lon < -34) return "أمريكا الجنوبية";

  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "شمال" : "جنوب"} · ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "شرق" : "غرب"}`;
}

/**
 * Cluster photos with GPS into buckets by rounding coordinates to
 * `precision` decimal degrees (default ~55 km at the equator).
 */
export function clusterByLocation(
  photos: GeoPhoto[],
  precision = 0.5,
): PlaceCluster[] {
  const buckets = new Map<string, GeoPhoto[]>();
  for (const p of photos) {
    const key = `${Math.round(p.lat / precision) * precision}|${Math.round(p.lon / precision) * precision}`;
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }

  const clusters: PlaceCluster[] = [];
  for (const [key, items] of buckets) {
    const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
    const lon = items.reduce((s, p) => s + p.lon, 0) / items.length;
    clusters.push({
      id: key,
      lat,
      lon,
      label: regionLabel(lat, lon),
      photos: items.sort((a, b) => b.date.getTime() - a.date.getTime()),
    });
  }
  return clusters.sort((a, b) => b.photos.length - a.photos.length);
}
