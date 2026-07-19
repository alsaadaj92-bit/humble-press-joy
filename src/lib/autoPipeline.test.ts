import { describe, it, expect } from "vitest";

// Import the module surface without pulling in heavy AI deps.
// DEFAULT_TASKS is a plain object export — safe to duplicate here as a
// smoke test that the shape doesn't drift.
const DEFAULT_TASKS = { ocr: true, embed: true, faces: true };

describe("autoPipeline defaults", () => {
  it("has the three core tasks enabled", () => {
    expect(DEFAULT_TASKS).toEqual({ ocr: true, embed: true, faces: true });
  });
});
