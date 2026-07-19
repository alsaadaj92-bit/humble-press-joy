import { describe, it, expect } from "vitest";
import { buildMemories } from "./memories";
import type { MockPhoto } from "./mockPhotos";

function mk(id: string, date: Date): MockPhoto {
  return { id, seed: id, width: 400, height: 400, date, name: `${id}.jpg` };
}

describe("buildMemories", () => {
  const today = new Date("2026-07-19T12:00:00Z");

  it("returns empty when no photos", () => {
    expect(buildMemories([], today)).toEqual([]);
  });

  it("creates on-this-day stories per past year", () => {
    const photos = [
      mk("a", new Date("2024-07-19T10:00:00Z")),
      mk("b", new Date("2023-07-19T10:00:00Z")),
      mk("c", new Date("2023-07-19T11:00:00Z")),
      mk("d", new Date("2026-07-19T09:00:00Z")), // same year — excluded
    ];
    const stories = buildMemories(photos, today);
    const otd = stories.filter((s) => s.kind === "on-this-day");
    expect(otd).toHaveLength(2);
    const y2023 = otd.find((s) => s.id === "otd-2023")!;
    expect(y2023.photos).toHaveLength(2);
    expect(y2023.subtitle).toContain("3");
  });

  it("creates a recent-week story only with >=3 photos", () => {
    const photos = [
      mk("r1", new Date("2026-07-18T10:00:00Z")),
      mk("r2", new Date("2026-07-17T10:00:00Z")),
      mk("r3", new Date("2026-07-15T10:00:00Z")),
    ];
    expect(buildMemories(photos, today).some((s) => s.kind === "recent")).toBe(true);
    expect(buildMemories(photos.slice(0, 2), today).some((s) => s.kind === "recent")).toBe(false);
  });
});
