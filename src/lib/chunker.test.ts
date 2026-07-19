import { describe, it, expect } from "vitest";
import { planChunks, remainingChunks, progressOf } from "./chunker";

describe("chunker", () => {
  it("plans exact-sized chunks", () => {
    const c = planChunks(10, 4);
    expect(c).toEqual([
      { index: 0, offset: 0, end: 4, size: 4 },
      { index: 1, offset: 4, end: 8, size: 4 },
      { index: 2, offset: 8, end: 10, size: 2 },
    ]);
  });

  it("handles empty file", () => {
    expect(planChunks(0, 4)).toEqual([]);
  });

  it("skips fully-uploaded chunks on resume", () => {
    const r = remainingChunks(10, 4, 4);
    expect(r.map((c) => c.offset)).toEqual([4, 8]);
  });

  it("trims a partially-received chunk on resume", () => {
    const r = remainingChunks(10, 6, 4);
    expect(r[0]).toEqual({ index: 1, offset: 6, end: 8, size: 2 });
    expect(r[1]).toEqual({ index: 2, offset: 8, end: 10, size: 2 });
  });

  it("progress fraction clamps to [0,1]", () => {
    expect(progressOf(0, 10)).toBe(0);
    expect(progressOf(5, 10)).toBe(0.5);
    expect(progressOf(20, 10)).toBe(1);
    expect(progressOf(5, 0)).toBe(0);
  });
});
