// Direct Telegram Bot API from the browser. No proxy, no cloud.
// The bot token stays inside the user's browser (IndexedDB) and is only sent
// to https://api.telegram.org over HTTPS, exactly as required by Telegram.

const API = (token: string) => `https://api.telegram.org/bot${token}`;
const FILE = (token: string) => `https://api.telegram.org/file/bot${token}`;

interface TgOk<T> {
  ok: true;
  result: T;
}
interface TgErr {
  ok: false;
  description: string;
  error_code?: number;
}
type TgResp<T> = TgOk<T> | TgErr;

async function tg<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = (await r.json()) as TgResp<T>;
  if (!j.ok) throw new Error((j as TgErr).description || `Telegram error ${r.status}`);
  return j.result;
}

export interface TgSendResult {
  fileId: string;
  messageId: number;
  width?: number;
  height?: number;
}

export async function telegramSendDocument(
  botToken: string,
  chatId: string,
  file: File,
): Promise<TgSendResult> {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", file, file.name);
  const res = await tg<{
    message_id: number;
    document?: { file_id: string; thumb?: { width: number; height: number } };
    photo?: Array<{ file_id: string; width: number; height: number }>;
  }>(`${API(botToken)}/sendDocument`, { method: "POST", body: form });
  const doc = res.document;
  const photo = res.photo?.[res.photo.length - 1];
  const fileId = doc?.file_id ?? photo?.file_id;
  if (!fileId) throw new Error("Telegram response missing file_id");
  return {
    fileId,
    messageId: res.message_id,
    width: photo?.width ?? doc?.thumb?.width,
    height: photo?.height ?? doc?.thumb?.height,
  };
}

export async function telegramGetFilePath(botToken: string, fileId: string) {
  const res = await tg<{ file_path: string }>(
    `${API(botToken)}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  return res.file_path;
}

export function telegramFileUrl(botToken: string, filePath: string) {
  return `${FILE(botToken)}/${filePath}`;
}

export async function telegramTest(botToken: string, chatId: string) {
  const chat = await tg<{ id: number; title?: string; username?: string; type: string }>(
    `${API(botToken)}/getChat?chat_id=${encodeURIComponent(chatId)}`,
  );
  return chat;
}

export interface TgBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export async function telegramGetMe(botToken: string): Promise<TgBotInfo> {
  return tg<TgBotInfo>(`${API(botToken)}/getMe`);
}

export interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string; title?: string; username?: string; first_name?: string };
    from?: { id: number; first_name?: string; username?: string };
  };
}

export async function telegramGetUpdates(
  botToken: string,
  offset?: number,
): Promise<TgUpdate[]> {
  const q = offset ? `?offset=${offset}` : "";
  return tg<TgUpdate[]>(`${API(botToken)}/getUpdates${q}`);
}
