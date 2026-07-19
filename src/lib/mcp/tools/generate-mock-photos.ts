import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Simple deterministic mock generator mirroring the app's demo grid shape.
// Kept self-contained so the tool file has no browser-only imports.
function makeMockPhotos(count: number, seed = 0) {
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  return Array.from({ length: count }, (_, i) => {
    const id = `mock-${seed}-${i}`;
    const width = 400 + ((i * 37) % 400);
    const height = 300 + ((i * 53) % 500);
    const date = new Date(now - i * day * 0.7).toISOString();
    return {
      id,
      name: `mock_${i + 1}.jpg`,
      width,
      height,
      date,
      thumbSrc: `https://picsum.photos/seed/${id}/${width}/${height}`,
    };
  });
}

export default defineTool({
  name: "generate_mock_photos",
  title: "Generate mock photos",
  description:
    "Return a deterministic list of placeholder photo entries (id, name, width, height, date, thumbSrc) matching the demo grid. Useful for testing gallery layouts.",
  inputSchema: {
    count: z.number().int().min(1).max(200).default(24).describe("How many mock photos to return (1–200)."),
    seed: z.number().int().min(0).max(9999).default(0).describe("Seed to vary the generated set."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ count, seed }) => {
    const photos = makeMockPhotos(count, seed);
    return {
      content: [{ type: "text", text: JSON.stringify(photos, null, 2) }],
      structuredContent: { photos },
    };
  },
});
