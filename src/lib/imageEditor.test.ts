import { describe, it, expect } from "vitest";
import {
  FILTER_PRESETS,
  NEUTRAL_ADJUSTMENTS,
  NEUTRAL_PIPELINE,
  isNeutralPipeline,
  resolveAdjustments,
  suggestEditedName,
  toCssFilter,
} from "./imageEditor";

describe("imageEditor pure helpers", () => {
  it("emits no filter for neutral adjustments", () => {
    expect(toCssFilter(NEUTRAL_ADJUSTMENTS)).toBe("none");
  });

  it("emits a compound CSS filter string", () => {
    const f = toCssFilter({
      ...NEUTRAL_ADJUSTMENTS,
      brightness: 1.2,
      saturate: 1.5,
      hueRotate: 30,
    });
    expect(f).toContain("brightness(1.2)");
    expect(f).toContain("saturate(1.5)");
    expect(f).toContain("hue-rotate(30deg)");
    expect(f).not.toContain("contrast");
  });

  it("resolves presets with overrides last", () => {
    const a = resolveAdjustments("vintage", { brightness: 2 });
    expect(a.sepia).toBe(FILTER_PRESETS.vintage.sepia);
    expect(a.brightness).toBe(2);
  });

  it("detects the neutral pipeline", () => {
    expect(isNeutralPipeline(NEUTRAL_PIPELINE)).toBe(true);
    expect(isNeutralPipeline({ ...NEUTRAL_PIPELINE, rotate: 90 })).toBe(false);
    expect(
      isNeutralPipeline({
        ...NEUTRAL_PIPELINE,
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      }),
    ).toBe(false);
    expect(
      isNeutralPipeline({
        ...NEUTRAL_PIPELINE,
        adjustments: { ...NEUTRAL_ADJUSTMENTS, brightness: 1.1 },
      }),
    ).toBe(false);
  });

  it("names edited files without losing extension", () => {
    expect(suggestEditedName("IMG_001.jpg")).toBe("IMG_001-edited.jpg");
    expect(suggestEditedName("no-ext")).toBe("no-ext-edited.jpg");
    expect(suggestEditedName("a.b.png")).toBe("a.b-edited.png");
  });
});
