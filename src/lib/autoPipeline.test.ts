import { describe, it, expect } from "vitest";
import { DEFAULT_TASKS } from "./autoPipeline";

describe("autoPipeline defaults", () => {
  it("enables the three core tasks by default", () => {
    expect(DEFAULT_TASKS).toEqual({ ocr: true, embed: true, faces: true });
  });
});
