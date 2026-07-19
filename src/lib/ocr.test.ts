import { describe, expect, it } from "vitest";
import { matchesOcr, normalizeText } from "./ocr";
import type { OcrRow } from "./photoDb";

const row = (text: string): OcrRow => ({
  id: "a",
  text,
  lang: "ara+eng",
  confidence: 90,
  updatedAt: 0,
});

describe("ocr text utils", () => {
  it("normalizes Arabic diacritics and whitespace", () => {
    expect(normalizeText("مَرْحَبًا    بك")).toBe("مرحبا بك");
    expect(normalizeText("  Hello  World ")).toBe("hello world");
  });

  it("matches case-insensitively and ignores diacritics", () => {
    expect(matchesOcr(row("Receipt Total: 45.20 USD"), "receipt")).toBe(true);
    expect(matchesOcr(row("مَرْحَبًا بالعالم"), "مرحبا")).toBe(true);
    expect(matchesOcr(row("nothing"), "missing")).toBe(false);
    expect(matchesOcr(undefined, "x")).toBe(false);
  });
});
