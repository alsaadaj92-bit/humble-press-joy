import { describe, expect, it } from "vitest";
import { cosine, normalize, topK } from "./semantic";

describe("semantic math", () => {
  it("normalizes a vector to unit length", () => {
    const n = normalize([3, 4]);
    expect(n[0]).toBeCloseTo(0.6, 5);
    expect(n[1]).toBeCloseTo(0.8, 5);
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2);
    expect(mag).toBeCloseTo(1, 5);
  });

  it("returns zeros safely for a zero vector", () => {
    const n = normalize([0, 0, 0]);
    expect(n).toEqual([0, 0, 0]);
  });

  it("cosine similarity of identical vectors is 1", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("cosine similarity of orthogonal vectors is 0", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("cosine similarity of opposite vectors is -1", () => {
    expect(cosine([1, 2], [-1, -2])).toBeCloseTo(-1, 5);
  });

  it("cosine returns 0 for empty vectors", () => {
    expect(cosine([0, 0], [0, 0])).toBe(0);
  });

  it("topK returns highest scored items in order", () => {
    const items = ["a", "b", "c", "d"];
    const scores: Record<string, number> = { a: 0.1, b: 0.9, c: 0.5, d: 0.7 };
    const result = topK(items, (x) => scores[x], 2);
    expect(result.map((r) => r.item)).toEqual(["b", "d"]);
    expect(result[0].score).toBeCloseTo(0.9);
  });
});
