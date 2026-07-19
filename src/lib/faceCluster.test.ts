import { describe, it, expect } from "vitest";
import { euclidean, meanVector, clusterFaces } from "./faceCluster";

describe("faceCluster", () => {
  it("euclidean distance", () => {
    expect(euclidean([0, 0], [3, 4])).toBeCloseTo(5);
    expect(euclidean([1, 2, 3], [1, 2, 3])).toBeCloseTo(0);
  });

  it("meanVector averages component-wise", () => {
    expect(meanVector([[1, 2], [3, 4], [5, 6]])).toEqual([3, 4]);
    expect(meanVector([])).toEqual([]);
  });

  it("clusters close descriptors together", () => {
    const faces = [
      { id: "a", assetId: "1", descriptor: [0, 0, 0] },
      { id: "b", assetId: "2", descriptor: [0.1, 0.1, 0] },
      { id: "c", assetId: "3", descriptor: [5, 5, 5] },
      { id: "d", assetId: "4", descriptor: [5.1, 5, 5] },
    ];
    const clusters = clusterFaces(faces, 0.55);
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((c) => c.faceIds.length).sort();
    expect(sizes).toEqual([2, 2]);
  });

  it("respects seed clusters (stable ids)", () => {
    const seed = [{ id: "p-known", centroid: [0, 0, 0], faceIds: ["x"] }];
    const clusters = clusterFaces(
      [{ id: "y", assetId: "2", descriptor: [0.05, 0, 0] }],
      0.55,
      seed,
    );
    const known = clusters.find((c) => c.id === "p-known");
    expect(known?.faceIds).toContain("y");
  });
});
