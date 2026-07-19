import { describe, it, expect } from "vitest";
import { collageGrid } from "./creations";

describe("creations.collageGrid", () => {
  it("returns sensible grids for common counts", () => {
    expect(collageGrid(1)).toEqual({ cols: 1, rows: 1 });
    expect(collageGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(collageGrid(4)).toEqual({ cols: 2, rows: 2 });
    expect(collageGrid(6)).toEqual({ cols: 3, rows: 2 });
    expect(collageGrid(9)).toEqual({ cols: 3, rows: 3 });
    expect(collageGrid(12)).toEqual({ cols: 4, rows: 3 });
  });
  it("scales for larger counts", () => {
    const g = collageGrid(20);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(20);
  });
});
