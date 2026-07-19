import { describe, it, expect } from "vitest";
import { formatDuration, isVideoMime, isVideoName } from "./video";

describe("formatDuration", () => {
  it("formats seconds as m:ss under an hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7)).toBe("0:07");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(599)).toBe("9:59");
  });
  it("formats hours as h:mm:ss", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
  it("handles bad input safely", () => {
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("isVideoMime / isVideoName", () => {
  it("detects video mimes", () => {
    expect(isVideoMime("video/mp4")).toBe(true);
    expect(isVideoMime("image/jpeg")).toBe(false);
    expect(isVideoMime(undefined)).toBe(false);
  });
  it("detects video extensions", () => {
    expect(isVideoName("clip.MP4")).toBe(true);
    expect(isVideoName("holiday.mov")).toBe(true);
    expect(isVideoName("photo.jpg")).toBe(false);
    expect(isVideoName("no-ext")).toBe(false);
  });
});
