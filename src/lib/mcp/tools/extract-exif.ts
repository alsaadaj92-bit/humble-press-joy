import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
// exifr is browser+node compatible; Deno resolves it via npm: at runtime.
import exifr from "exifr";

export default defineTool({
  name: "extract_exif_from_url",
  title: "Extract EXIF from an image URL",
  description:
    "Fetch an image over HTTPS server-side and return the EXIF metadata (date taken, camera, lens, dimensions, GPS if present). The image bytes are not stored.",
  inputSchema: {
    url: z
      .string()
      .url()
      .describe("Publicly reachable HTTPS URL of an image (JPEG/HEIC/TIFF)."),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async ({ url }) => {
    if (!/^https:\/\//i.test(url)) {
      return {
        content: [{ type: "text", text: "URL must start with https://" }],
        isError: true,
      };
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return {
          content: [
            { type: "text", text: `Fetch failed: ${res.status} ${res.statusText}` },
          ],
          isError: true,
        };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const parsed = (await exifr.parse(buf, { gps: true })) ?? {};
      const summary = {
        dateTaken:
          parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.ModifyDate ?? null,
        make: parsed.Make ?? null,
        model: parsed.Model ?? null,
        lens: parsed.LensModel ?? parsed.LensMake ?? null,
        orientation: parsed.Orientation ?? null,
        width: parsed.ExifImageWidth ?? parsed.ImageWidth ?? null,
        height: parsed.ExifImageHeight ?? parsed.ImageHeight ?? null,
        iso: parsed.ISO ?? null,
        fNumber: parsed.FNumber ?? null,
        exposureTime: parsed.ExposureTime ?? null,
        focalLength: parsed.FocalLength ?? null,
        gps:
          parsed.latitude != null && parsed.longitude != null
            ? { latitude: parsed.latitude, longitude: parsed.longitude }
            : null,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `EXIF extraction failed: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
});
