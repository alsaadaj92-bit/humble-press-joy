// Central diagnostics log. In-memory ring buffer + IndexedDB fallback so the
// user can copy a full report from Settings even after reloads.
import { photoDb } from "./photoDb";

export type DiagLevel = "info" | "warn" | "error";
export interface DiagEntry {
  ts: number;
  level: DiagLevel;
  scope: string;
  message: string;
  detail?: string;
}

const BUFFER_MAX = 300;
const KV_KEY = "diagnostics:log";
const buffer: DiagEntry[] = [];
const listeners = new Set<(entries: DiagEntry[]) => void>();
let hydrated = false;
let persistTimer: number | null = null;

function emit() {
  const snap = [...buffer];
  for (const l of listeners) l(snap);
}

function schedulePersist() {
  if (persistTimer != null) return;
  persistTimer = window.setTimeout(async () => {
    persistTimer = null;
    try {
      await photoDb.kv.put({ key: KV_KEY, value: JSON.stringify(buffer.slice(-BUFFER_MAX)) });
    } catch { /* ignore */ }
  }, 800);
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const row = await photoDb.kv.get(KV_KEY);
    if (row?.value) {
      const parsed = JSON.parse(row.value) as DiagEntry[];
      if (Array.isArray(parsed)) buffer.push(...parsed.slice(-BUFFER_MAX));
      emit();
    }
  } catch { /* ignore */ }
}

export function logDiag(level: DiagLevel, scope: string, message: string, detail?: unknown) {
  const entry: DiagEntry = {
    ts: Date.now(),
    level,
    scope,
    message,
    detail: detail == null ? undefined : detail instanceof Error
      ? `${detail.name}: ${detail.message}\n${detail.stack ?? ""}`
      : typeof detail === "string" ? detail : safeStringify(detail),
  };
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `[${scope}]`, message, detail ?? "",
  );
  emit();
  schedulePersist();
}

function safeStringify(v: unknown) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export function subscribeDiagnostics(cb: (entries: DiagEntry[]) => void) {
  void hydrate();
  cb([...buffer]);
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getDiagnostics(): DiagEntry[] { return [...buffer]; }

export async function clearDiagnostics() {
  buffer.length = 0;
  try { await photoDb.kv.delete(KV_KEY); } catch { /* ignore */ }
  emit();
}

export function buildDiagnosticsReport(): string {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const ua = (nav as Navigator).userAgent ?? "";
  const lang = (nav as Navigator).language ?? "";
  const online = (nav as Navigator).onLine;
  const platform = (nav as Navigator).platform ?? "";
  const header = [
    `# Localphotos Pro — Diagnostics Report`,
    `Generated: ${new Date().toISOString()}`,
    `UA: ${ua}`,
    `Platform: ${platform}`,
    `Lang: ${lang}`,
    `Online: ${online}`,
    `Entries: ${buffer.length}`,
    "",
  ].join("\n");
  const body = buffer.map((e) => {
    const t = new Date(e.ts).toISOString();
    const detail = e.detail ? `\n  ${e.detail.replace(/\n/g, "\n  ")}` : "";
    return `[${t}] ${e.level.toUpperCase()} ${e.scope}: ${e.message}${detail}`;
  }).join("\n");
  return header + body;
}

// -- global installers ------------------------------------------------------
let installed = false;
export function installGlobalDiagHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  void hydrate();
  window.addEventListener("error", (e) => {
    logDiag("error", "window", e.message || "unknown error", e.error ?? e.filename);
  });
  window.addEventListener("unhandledrejection", (e) => {
    logDiag("error", "promise", "unhandled rejection", e.reason);
  });
  logDiag("info", "app", "diagnostics initialized");
}
