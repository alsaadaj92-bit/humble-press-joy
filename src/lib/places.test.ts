import { describe, it, expect } from "vitest";
import { clusterByLocation, regionLabel, type GeoPhoto } from "./places";

function geo(id: string, lat: number, lon: number): GeoPhoto {
  return {
    id,
    seed: id,
    width: 400,
    height: 400,
    date: new Date("2025-01-01"),
    name: `${id}.jpg`,
    lat,
    lon,
  };
}

describe("regionLabel", () => {
  it("labels the Middle East", () => {
    expect(regionLabel(24.7, 46.7)).toBe("الشرق الأوسط"); // Riyadh
    expect(regionLabel(33.3, 44.4)).toBe("الشرق الأوسط"); // Baghdad
  });
  it("labels Europe and North America", () => {
    expect(regionLabel(48.85, 2.35)).toBe("أوروبا"); // Paris
    expect(regionLabel(40.7, -74.0)).toBe("أمريكا الشمالية"); // NYC
  });
  it("falls back to coordinates in the middle of an ocean", () => {
    expect(regionLabel(0, -140)).toMatch(/°/);
  });
});

describe("clusterByLocation", () => {
  it("returns [] for no photos", () => {
    expect(clusterByLocation([])).toEqual([]);
  });

  it("groups nearby coordinates into a single cluster", () => {
    const photos = [
      geo("a", 24.71, 46.68),
      geo("b", 24.72, 46.69),
      geo("c", 24.7, 46.71),
    ];
    const clusters = clusterByLocation(photos, 0.5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(3);
    expect(clusters[0].label).toBe("الشرق الأوسط");
  });

  it("splits distant coordinates into separate clusters, biggest first", () => {
    const photos = [
      geo("a", 24.7, 46.7),
      geo("b", 24.71, 46.71),
      geo("c", 48.85, 2.35),
    ];
    const clusters = clusterByLocation(photos, 0.5);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].photos.length).toBeGreaterThanOrEqual(clusters[1].photos.length);
  });
});
