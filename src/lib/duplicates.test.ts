import { describe, it, expect } from "vitest";
import { findDuplicates, normalizeName } from "./duplicates";
import type { MockPhoto } from "./mockPhotos";
import type { PhotoState } from "./photoDb";

function mk(id: string, name: string, size?: number, date = new Date("2025-01-01")): MockPhoto {
  const p = { id, seed: id, width: 400, height: 400, date, name } as MockPhoto;
  if (size !== undefined) (p as unknown as { size: number }).size = size;
  return p;
}

describe("normalizeName", () => {
  it("strips copy suffixes", () => {
    expect(normalizeName("IMG_2001 (1).jpg")).toBe("img_2001");
    expect(normalizeName("photo-copy.png")).toBe("photo");
    expect(normalizeName("sunset 2.jpg")).toBe("sunset");
    expect(normalizeName("beach.jpg")).toBe("beach");
  });
});

describe("findDuplicates", () => {
  const states = new Map<string, PhotoState>();

  it("returns empty when no duplicates", () => {
    expect(findDuplicates([mk("a", "one.jpg", 100), mk("b", "two.jpg", 200)], states)).toEqual([]);
  });

  it("detects size duplicates", () => {
    const groups = findDuplicates(
      [mk("a", "one.jpg", 1024), mk("b", "two.jpg", 1024), mk("c", "three.jpg", 999)],
      states,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("size");
    expect(groups[0].photos.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("detects EXIF timestamp duplicates", () => {
    const s = new Map<string, PhotoState>();
    const t = new Date("2025-05-01T10:00:00Z").getTime();
    s.set("a", { id: "a", exif: { dateTaken: t } });
    s.set("b", { id: "b", exif: { dateTaken: t + 200 } });
    const groups = findDuplicates([mk("a", "a.jpg"), mk("b", "b.jpg")], s);
    expect(groups.some((g) => g.reason === "exif-time")).toBe(true);
  });

  it("detects name-normalized duplicates", () => {
    const groups = findDuplicates(
      [mk("a", "sunset.jpg"), mk("b", "sunset (1).jpg"), mk("c", "sunset-copy.jpg")],
      states,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("name");
    expect(groups[0].photos).toHaveLength(3);
  });

  it("does not emit the same set twice under different reasons", () => {
    const groups = findDuplicates(
      [mk("a", "img.jpg", 1024), mk("b", "img (1).jpg", 1024)],
      states,
    );
    expect(groups).toHaveLength(1); // size wins, name group is deduped
  });
});
