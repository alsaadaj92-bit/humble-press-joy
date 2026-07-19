// POSTs multipart uploads to the user's own Node.js companion server.
// The server code is provided in Phase 3. Contract:
//   GET  {base}/health       -> 200 { ok: true }
//   POST {base}/upload       -> 200 { url, path, name, size }
//   GET  {base}/files/<path> -> the file bytes (used to render thumbnails)

function normalize(base: string) {
  return base.replace(/\/+$/, "");
}

export async function localServerTest(baseUrl: string) {
  const r = await fetch(`${normalize(baseUrl)}/health`, { method: "GET" });
  if (!r.ok) throw new Error(`الخادم رد بالحالة ${r.status}`);
  return (await r.json().catch(() => ({}))) as Record<string, unknown>;
}

export interface LsUploadResult {
  url: string;
  path: string;
}

export async function localServerUpload(
  baseUrl: string,
  file: File,
): Promise<LsUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  const r = await fetch(`${normalize(baseUrl)}/upload`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error(`فشل الرفع (${r.status})`);
  const j = (await r.json()) as { url?: string; path?: string };
  if (!j.url || !j.path) throw new Error("رد الخادم غير صالح");
  // If server returns a relative URL, prefix with baseUrl.
  const url = /^https?:\/\//i.test(j.url) ? j.url : `${normalize(baseUrl)}${j.url}`;
  return { url, path: j.path };
}
