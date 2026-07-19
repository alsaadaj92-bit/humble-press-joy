import type { MediaAsset, TopicRule } from "./photoDb";

/**
 * Given an asset (with EXIF) and a set of topic rules, pick the topicId
 * to route it into. Rules are evaluated in ascending priority; first match wins.
 * `default` rule (if present) is the final fallback.
 */
export function pickTopicForAsset(
  asset: Pick<MediaAsset, "date" | "exif">,
  rules: TopicRule[],
): number | undefined {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const d = new Date(asset.date);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const ym = `${year}-${month}`;
  const camera = asset.exif?.camera ?? "";
  const hasGps = asset.exif?.gps ? "yes" : "no";

  for (const r of sorted) {
    if (r.kind === "default") continue;
    if (r.kind === "by-year" && r.match === year) return r.topicId;
    if (r.kind === "by-year-month" && r.match === ym) return r.topicId;
    if (
      r.kind === "by-camera" &&
      r.match &&
      camera.toLowerCase().includes(r.match.toLowerCase())
    )
      return r.topicId;
    if (r.kind === "by-has-gps" && r.match === hasGps) return r.topicId;
  }
  const def = sorted.find((r) => r.kind === "default");
  return def?.topicId;
}

export function describeRule(r: TopicRule): string {
  switch (r.kind) {
    case "by-year":
      return `صور سنة ${r.match}`;
    case "by-year-month":
      return `صور شهر ${r.match}`;
    case "by-camera":
      return `صور كاميرا ${r.match}`;
    case "by-has-gps":
      return r.match === "yes" ? "الصور التي بها موقع GPS" : "الصور بدون موقع GPS";
    case "default":
      return "الافتراضي (كل ما تبقى)";
  }
}
