import { describe, it, expect } from "vitest";
import { shouldCompress, DEFAULT_COMPRESS } from "./compress";

function mkFile(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("compress.shouldCompress", () => {
  it("skips when disabled", () => {
    const f = mkFile("a.jpg", "image/jpeg", 1_000_000);
    expect(shouldCompress(f, { ...DEFAULT_COMPRESS, enabled: false })).toBe(false);
  });

  it("skips videos", () => {
    const f = mkFile("a.mp4", "video/mp4", 5_000_000);
    expect(shouldCompress(f, { ...DEFAULT_COMPRESS, enabled: true })).toBe(false);
  });

  it("skips small images under threshold", () => {
    const f = mkFile("a.jpg", "image/jpeg", 50 * 1024);
    expect(
      shouldCompress(f, { ...DEFAULT_COMPRESS, enabled: true, skipUnderKb: 300 }),
    ).toBe(false);
  });

  it("compresses large jpeg", () => {
    const f = mkFile("a.jpg", "image/jpeg", 2_000_000);
    expect(shouldCompress(f, { ...DEFAULT_COMPRESS, enabled: true })).toBe(true);
  });

  it("skips unsupported mime (gif)", () => {
    const f = mkFile("a.gif", "image/gif", 2_000_000);
    expect(shouldCompress(f, { ...DEFAULT_COMPRESS, enabled: true })).toBe(false);
  });
});
