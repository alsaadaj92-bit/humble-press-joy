import { defineTool } from "@lovable.dev/mcp-js";

const DESCRIPTION = `LocalGallery Pro — a privacy-first, "Zero-Cloud" Google Photos alternative.

Core rules:
- No third-party cloud storage for media (no Supabase Storage, Firebase, AWS, etc.).
- Photos and videos are routed to user-controlled destinations only:
    1. A local Node.js companion server on the user's PC / LAN.
    2. Telegram (user's own bot + chat id) via direct browser -> Telegram API calls.
    3. Browser File System Access API (direct local folder writes).
- All metadata (EXIF, favorites, archive, trash, provider config) lives in the browser's
  IndexedDB via Dexie.js. Actual file bytes are NEVER stored in IndexedDB.
- UI: dark theme, RTL Arabic, Google Photos-style masonry + timeline + lightbox,
  local EXIF extraction (exifr), and an inline SVG mini-map for GPS coordinates
  (no external map tiles).

This MCP server exposes a few stateless helper tools. It cannot read any given
end-user's browser IndexedDB — photo library data stays on the device.`;

export default defineTool({
  name: "explain_app",
  title: "Explain LocalGallery Pro",
  description:
    "Return a description of LocalGallery Pro, its Zero-Cloud policy, storage providers, and current features.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: DESCRIPTION }] }),
});
