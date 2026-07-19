import { describe, it, expect } from "vitest";
import { buildTimelineBuckets, collapseToYears, monthKey, monthLabel } from "./timeline";
import type { MockPhoto } from "./mockPhotos";

const p = (id: string, iso: string): MockPhoto => ({
  id,
  seed: id,
  name: id,
  width: 100,
  height: 100,
  date: new Date(iso),
});

describe("timeline", () => {
  it("monthKey pads month", () => {
    expect(monthKey(new Date("2024-03-15"))).toBe("2024-03");
    expect(monthKey(new Date("2024-11-01"))).toBe("2024-11");
  });

  it("monthLabel returns Arabic name", () => {
    expect(monthLabel(2024, 1)).toBe("يناير 2024");
    expect(monthLabel(2023, 12)).toBe("ديسمبر 2023");
  });

  it("buildTimelineBuckets groups by month, newest first", () => {
    const buckets = buildTimelineBuckets([
      p("a", "2024-03-01"),
      p("b", "2024-03-15"),
      p("c", "2023-12-20"),
      p("d", "2025-01-05"),
    ]);
    expect(buckets.map((x) => x.key)).toEqual(["2025-01", "2024-03", "2023-12"]);
    expect(buckets[1].count).toBe(2);
  });

  it("collapseToYears aggregates counts and keeps latest firstKey", () => {
    const buckets = buildTimelineBuckets([
      p("a", "2024-03-01"),
      p("b", "2024-06-15"),
      p("c", "2023-12-20"),
    ]);
    const years = collapseToYears(buckets);
    expect(years).toEqual([
      { year: 2024, count: 2, firstKey: "2024-06" },
      { year: 2023, count: 1, firstKey: "2023-12" },
    ]);
  });

  it("handles empty input", () => {
    expect(buildTimelineBuckets([])).toEqual([]);
    expect(collapseToYears([])).toEqual([]);
  });
});
