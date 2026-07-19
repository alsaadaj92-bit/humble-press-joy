import { defineMcp } from "@lovable.dev/mcp-js";
import explainApp from "./tools/explain-app";
import extractExif from "./tools/extract-exif";
import sendTelegramPhoto from "./tools/send-telegram-photo";
import generateMockPhotos from "./tools/generate-mock-photos";

export default defineMcp({
  name: "localgallery-pro-mcp",
  title: "LocalGallery Pro MCP",
  version: "0.1.0",
  instructions:
    "Public helper tools for LocalGallery Pro — a privacy-first, Zero-Cloud photo gallery. Use `explain_app` for context, `extract_exif_from_url` to read image metadata, `send_telegram_photo` to forward an image URL to a user-supplied Telegram bot+chat, and `generate_mock_photos` to produce demo gallery data. This server is stateless and cannot read any user's local IndexedDB photo library.",
  tools: [explainApp, extractExif, sendTelegramPhoto, generateMockPhotos],
});
