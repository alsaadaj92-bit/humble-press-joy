import { describe, it, expect } from "vitest";
import { TRASH_TTL_MS, trashInfo, selectExpiredIds, formatRemaining } from "./trash";

describe("trash lifecycle", () => {
  const NOW = 1_700_000_000_000;

  it("returns null when not trashed", () => {
    expect(trashInfo({}, NOW)).toBeNull();
  });

  it("computes remaining days within TTL", () => {
    const info = trashInfo({ trashedAt: NOW - 5 * 24 * 60 * 60 * 1000 }, NOW);
    expect(info?.expired).toBe(false);
    expect(info?.daysRemaining).toBe(25);
    expect(info?.msRemaining).toBeGreaterThan(0);
  });

  it("marks expired when past TTL", () => {
    const info = trashInfo({ trashedAt: NOW - TRASH_TTL_MS - 1 }, NOW);
    expect(info?.expired).toBe(true);
    expect(info?.msRemaining).toBe(0);
  });

  it("selectExpiredIds picks only past-TTL entries", () => {
    const states = [
      { id: "a", trashedAt: NOW - TRASH_TTL_MS - 1000 },
      { id: "b", trashedAt: NOW - 1000 },
      { id: "c" },
      { id: "d", trashedAt: NOW - TRASH_TTL_MS },
    ];
    const ids = selectExpiredIds(states, NOW).sort();
    expect(ids).toEqual(["a", "d"]);
  });

  it("formats remaining Arabic labels", () => {
    expect(formatRemaining(0)).toBe("انتهت المدة");
    expect(formatRemaining(1)).toBe("يوم واحد متبقٍ");
    expect(formatRemaining(2)).toBe("يومان متبقيان");
    expect(formatRemaining(7)).toBe("7 أيام متبقية");
    expect(formatRemaining(20)).toBe("20 يوماً متبقياً");
  });
});
