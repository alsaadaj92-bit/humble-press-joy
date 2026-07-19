import { describe, it, expect } from "vitest";
import { parseQuery, matchPhoto, searchPhotos, describeQuery } from "./search";
import type { MockPhoto } from "./mockPhotos";
import type { PhotoState } from "./photoDb";

function photo(over: Partial<MockPhoto> & { id: string }): MockPhoto {
  return {
    id: over.id,
    seed: over.id,
    width: 400,
    height: 400,
    date: over.date ?? new Date("2024-06-15T10:00:00Z"),
    name: over.name ?? "IMG_0001.jpg",
    ...over,
  };
}

const ctx = (states: Array<[string, PhotoState]> = []) => ({
  states: new Map(states),
});

describe("parseQuery", () => {
  it("parses key:value tokens and bare terms", () => {
    const q = parseQuery("beach year:2024 month:يونيو is:favorite has:gps ext:JPG");
    expect(q.year).toBe(2024);
    expect(q.month).toBe(6);
    expect(q.is.favorite).toBe(true);
    expect(q.has.gps).toBe(true);
    expect(q.ext).toBe("jpg");
    expect(q.terms).toEqual(["beach"]);
  });

  it("parses english month names and numeric months", () => {
    expect(parseQuery("month:january").month).toBe(1);
    expect(parseQuery("month:12").month).toBe(12);
    expect(parseQuery("month:notamonth").month).toBeUndefined();
  });

  it("parses date bounds", () => {
    const q = parseQuery("min:2023-05 max:2024");
    expect(q.min).toEqual({ y: 2023, m: 5 });
    expect(q.max).toEqual({ y: 2024, m: 0 });
  });
});

describe("matchPhoto", () => {
  it("filters by year and month", () => {
    const p = photo({ id: "a", date: new Date("2024-06-15") });
    expect(matchPhoto(p, parseQuery("year:2024"), ctx())).toBe(true);
    expect(matchPhoto(p, parseQuery("year:2023"), ctx())).toBe(false);
    expect(matchPhoto(p, parseQuery("month:6"), ctx())).toBe(true);
    expect(matchPhoto(p, parseQuery("month:يونيو"), ctx())).toBe(true);
    expect(matchPhoto(p, parseQuery("month:1"), ctx())).toBe(false);
  });

  it("filters by is:favorite via state map", () => {
    const p = photo({ id: "a" });
    expect(
      matchPhoto(p, parseQuery("is:favorite"), ctx([["a", { id: "a", favorite: true }]])),
    ).toBe(true);
    expect(matchPhoto(p, parseQuery("is:favorite"), ctx())).toBe(false);
  });

  it("filters by has:gps and camera via exif", () => {
    const p = photo({ id: "a" });
    const c = ctx([
      ["a", { id: "a", exif: { camera: "Canon EOS R6", gps: { lat: 30, lon: 45 } } }],
    ]);
    expect(matchPhoto(p, parseQuery("has:gps"), c)).toBe(true);
    expect(matchPhoto(p, parseQuery("camera:canon"), c)).toBe(true);
    expect(matchPhoto(p, parseQuery("camera:nikon"), c)).toBe(false);
    // GPS box (30,45) sits in the Middle-East region label
    expect(matchPhoto(p, parseQuery("place:الشرق"), c)).toBe(true);
  });

  it("filters by extension and date bounds", () => {
    const p = photo({ id: "a", name: "trip.PNG", date: new Date("2023-08-01") });
    expect(matchPhoto(p, parseQuery("ext:png"), ctx())).toBe(true);
    expect(matchPhoto(p, parseQuery("ext:jpg"), ctx())).toBe(false);
    expect(matchPhoto(p, parseQuery("min:2023 max:2024"), ctx())).toBe(true);
    expect(matchPhoto(p, parseQuery("min:2024"), ctx())).toBe(false);
  });

  it("bare terms match against name/year/camera/region", () => {
    const p = photo({ id: "a", name: "beach.jpg", date: new Date("2024-01-01") });
    const c = ctx([["a", { id: "a", exif: { camera: "Sony A7" } }]]);
    expect(matchPhoto(p, parseQuery("beach"), c)).toBe(true);
    expect(matchPhoto(p, parseQuery("2024"), c)).toBe(true);
    expect(matchPhoto(p, parseQuery("sony"), c)).toBe(true);
    expect(matchPhoto(p, parseQuery("nikon"), c)).toBe(false);
  });
});

describe("searchPhotos", () => {
  it("returns all when query is empty", () => {
    const list = [photo({ id: "a" }), photo({ id: "b" })];
    expect(searchPhotos(list, "  ", ctx())).toHaveLength(2);
  });

  it("combines multiple filters (AND)", () => {
    const list = [
      photo({ id: "a", name: "beach.jpg", date: new Date("2024-06-01") }),
      photo({ id: "b", name: "beach.jpg", date: new Date("2023-06-01") }),
      photo({ id: "c", name: "city.jpg", date: new Date("2024-06-01") }),
    ];
    const out = searchPhotos(list, "beach year:2024", ctx());
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("describeQuery", () => {
  it("produces readable chips", () => {
    const chips = describeQuery(parseQuery("year:2024 is:favorite has:gps"));
    expect(chips).toContain("سنة: 2024");
    expect(chips).toContain("مفضلة");
    expect(chips).toContain("لديها موقع");
  });
});
