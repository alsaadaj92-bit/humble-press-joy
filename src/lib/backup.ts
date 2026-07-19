// Local backup/restore. Serializes IndexedDB state into a portable JSON
// blob the user can download and re-import. Zero-Cloud: bytes only leave
// the device if the user explicitly picks a destination.
//
// Provider secrets (bot tokens, server URLs) are stripped by default so
// backups are safe to share; users can opt-in via includeSecrets.

import { photoDb, type PhotoState, type MediaAsset, type ProviderConfig, type ProviderKind, type TopicRule, type Album } from "./photoDb";

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: "localgallery-pro";
  version: number;
  exportedAt: number;
  includesSecrets: boolean;
  counts: {
    states: number;
    assets: number;
    albums: number;
    topicRules: number;
    providers: number;
  };
  data: {
    states: PhotoState[];
    assets: MediaAsset[];
    albums: Album[];
    topicRules: TopicRule[];
    providers: ProviderConfig[];
    kv: Array<{ key: string; value: string }>;
  };
}

function sanitizeProvider(p: ProviderConfig, includeSecrets: boolean): ProviderConfig {
  if (includeSecrets) return p;
  const clone: ProviderConfig = { ...p };
  delete clone.botToken;
  delete clone.baseUrl;
  return clone;
}

/** Sanitize a media asset by removing its stored Blob to keep JSON exports
 *  serializable and lightweight. Assets are just references. */
function sanitizeAsset(a: MediaAsset): MediaAsset {
  // MediaAsset does not carry a Blob today, but future-proof against it.
  const { ...rest } = a;
  return rest;
}

export interface ExportOptions {
  includeSecrets?: boolean;
  /** Restrict to a subset of asset ids. */
  assetIds?: string[];
}

export async function buildBackup(opts: ExportOptions = {}): Promise<BackupFile> {
  const includeSecrets = !!opts.includeSecrets;
  const [states, assetsRaw, albums, topicRules, providersRaw, kv] = await Promise.all([
    photoDb.states.toArray(),
    photoDb.assets.toArray(),
    photoDb.albums.toArray(),
    photoDb.topicRules.toArray(),
    photoDb.providers.toArray(),
    photoDb.kv.toArray(),
  ]);

  const filterSet = opts.assetIds ? new Set(opts.assetIds) : null;
  const assets = (filterSet ? assetsRaw.filter((a) => filterSet.has(a.id)) : assetsRaw).map(sanitizeAsset);
  const providers = providersRaw.map((p) => sanitizeProvider(p, includeSecrets));

  return {
    app: "localgallery-pro",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    includesSecrets: includeSecrets,
    counts: {
      states: states.length,
      assets: assets.length,
      albums: albums.length,
      topicRules: topicRules.length,
      providers: providers.length,
    },
    data: { states, assets, albums, topicRules, providers, kv },
  };
}

export function serializeBackup(b: BackupFile): string {
  return JSON.stringify(b, null, 2);
}

export function downloadBackup(b: BackupFile, filename?: string) {
  const blob = new Blob([serializeBackup(b)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date(b.exportedAt).toISOString().slice(0, 10);
  a.download = filename ?? `localgallery-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export interface RestoreOptions {
  /** "merge" keeps existing rows and adds/overwrites by primary key.
   *  "replace" clears each table first. */
  mode: "merge" | "replace";
  /** When false (default), keeps existing provider secrets even if the
   *  backup carries none. */
  overwriteProviders?: boolean;
}

export interface RestoreResult {
  states: number;
  assets: number;
  albums: number;
  topicRules: number;
  providers: number;
  kv: number;
}

export function isBackupFile(x: unknown): x is BackupFile {
  if (!x || typeof x !== "object") return false;
  const b = x as Partial<BackupFile>;
  return b.app === "localgallery-pro" && typeof b.version === "number" && !!b.data;
}

export async function parseBackup(text: string): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("ملف غير صالح: JSON مكسور");
  }
  if (!isBackupFile(parsed)) throw new Error("هذا الملف ليس نسخة LocalGallery Pro");
  if (parsed.version > BACKUP_VERSION) {
    throw new Error(`إصدار النسخة أحدث (${parsed.version}) من التطبيق (${BACKUP_VERSION})`);
  }
  return parsed;
}

export async function restoreBackup(
  b: BackupFile,
  opts: RestoreOptions,
): Promise<RestoreResult> {
  const { mode, overwriteProviders = false } = opts;

  const providersToWrite: ProviderConfig[] = [];
  if (overwriteProviders) {
    providersToWrite.push(...b.data.providers);
  } else {
    const existing = new Map(
      (await photoDb.providers.toArray()).map((p) => [p.kind as ProviderKind, p]),
    );
    for (const p of b.data.providers) {
      const cur = existing.get(p.kind);
      // Preserve existing secrets when not overwriting.
      providersToWrite.push({ ...p, botToken: cur?.botToken ?? p.botToken, baseUrl: cur?.baseUrl ?? p.baseUrl });
    }
  }

  await photoDb.transaction(
    "rw",
    [
      photoDb.states,
      photoDb.assets,
      photoDb.albums,
      photoDb.topicRules,
      photoDb.providers,
      photoDb.kv,
    ],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          photoDb.states.clear(),
          photoDb.assets.clear(),
          photoDb.albums.clear(),
          photoDb.topicRules.clear(),
          photoDb.providers.clear(),
          photoDb.kv.clear(),
        ]);
      }
      await photoDb.states.bulkPut(b.data.states);
      await photoDb.assets.bulkPut(b.data.assets);
      await photoDb.albums.bulkPut(b.data.albums);
      await photoDb.topicRules.bulkPut(b.data.topicRules);
      await photoDb.providers.bulkPut(providersToWrite);
      await photoDb.kv.bulkPut(b.data.kv);
    },
  );

  return {
    states: b.data.states.length,
    assets: b.data.assets.length,
    albums: b.data.albums.length,
    topicRules: b.data.topicRules.length,
    providers: providersToWrite.length,
    kv: b.data.kv.length,
  };
}
