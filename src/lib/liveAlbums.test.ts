import { describe, it, expect } from "vitest";
import { evaluate, type LiveRule } from "./liveAlbums";
import type { MockPhoto } from "./mockPhotos";
import type { PhotoState } from "./photoDb";

const photo = (over: Partial<MockPhoto> = {}): MockPhoto => ({
  id: "p1",
  seed: "s",
  width: 100,
  height: 100,
  date: new Date(2024, 5, 10),
  name: "IMG_0001.jpg",
  ...over,
});

describe("liveAlbums.evaluate", () => {
  it("AND-combines rules", () => {
    const rules: LiveRule[] = [{ kind: "favorite" }, { kind: "year", value: 2024 }];
    const s: PhotoState = { id: "p1", favorite: true };
    expect(evaluate(photo(), s, rules)).toBe(true);
    expect(evaluate(photo({ date: new Date(2023, 1, 1) }), s, rules)).toBe(false);
    expect(evaluate(photo(), { id: "p1" }, rules)).toBe(false);
  });
  it("matches video kind and name-contains", () => {
    expect(evaluate(photo({ kind: "video" }), undefined, [{ kind: "kind-video" }])).toBe(true);
    expect(
      evaluate(photo({ name: "SCREEN_01.png" }), undefined, [
        { kind: "name-contains", value: "screen" },
      ]),
    ).toBe(true);
  });
});
