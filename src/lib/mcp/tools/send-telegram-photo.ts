import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "send_telegram_photo",
  title: "Send a photo to Telegram",
  description:
    "Forward an image URL to Telegram's sendDocument API using the caller-provided bot token and chat id. The bot token is used only for this single request and is never stored server-side. This mirrors the direct browser -> Telegram flow the app uses.",
  inputSchema: {
    botToken: z
      .string()
      .min(10)
      .describe("Telegram bot token from @BotFather. Used once, not stored."),
    chatId: z
      .string()
      .min(1)
      .describe("Target chat id (e.g. your @userinfobot id, or a channel id)."),
    imageUrl: z
      .string()
      .url()
      .describe("HTTPS URL of the image/document to send."),
    caption: z.string().max(1024).optional().describe("Optional caption."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async ({ botToken, chatId, imageUrl, caption }) => {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
      const body = new URLSearchParams({
        chat_id: chatId,
        document: imageUrl,
        ...(caption ? { caption } : {}),
      });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json()) as {
        ok: boolean;
        description?: string;
        result?: { message_id: number };
      };
      if (!json.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Telegram error: ${json.description ?? "unknown"}`,
            },
          ],
          isError: true,
        };
      }
      const out = {
        ok: true,
        messageId: json.result?.message_id ?? null,
        chatId,
      };
      return {
        content: [
          {
            type: "text",
            text: `Sent. message_id=${out.messageId ?? "?"} chat_id=${chatId}`,
          },
        ],
        structuredContent: out,
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Telegram request failed: ${(err as Error).message}` },
        ],
        isError: true,
      };
    }
  },
});
