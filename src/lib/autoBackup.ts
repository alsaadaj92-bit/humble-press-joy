// Weekly automated local backup + orphan metadata sweep.
// Zero-Cloud: writes a JSON blob to the browser Downloads folder (user still
// controls where it lands via the browser). Never uploads anywhere.

import { photoDb } from "./photoDb";
import { buildBackup, downloadBackup } from "./backup";

export const AUTO_BACKUP_KV_KEY = "autoBackup";
export const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

export interface AutoBackupSettings {
  enabled: boolean;
  lastRunAt: number;
  intervalMs: number;
}

export const DEFAULT_AUTO_BACKUP: AutoBackupSettings = {
  enabled: false,
  lastRunAt: 0,
  intervalMs: AUTO_BACKUP_INTERVAL_MS,
};

export async function getAutoBackupSettings(): Promise<AutoBackupSettings> {
  const raw = await photoDb.kv.get(AUTO_BACKUP_KV_KEY);
  if (!raw?.value) return { ...DEFAULT_AUTO_BACKUP };
  try {
    return { ...DEFAULT_AUTO_BACKUP, ...JSON.parse(raw.value) };
  } catch {
    return { ...DEFAULT_AUTO_BACKUP };
  }
}

export async function setAutoBackupSettings(
  patch: Partial<AutoBackupSettings>,
): Promise<AutoBackupSettings> {
  const current = await getAutoBackupSettings();
  const merged = { ...current, ...patch };
  await photoDb.kv.put({ key: AUTO_BACKUP_KV_KEY, value: JSON.stringify(merged) });
  return merged;
}

/** Pure helper: is a run due? */
export function isBackupDue(s: AutoBackupSettings, now = Date.now()): boolean {
  if (!s.enabled) return false;
  return now - (s.lastRunAt || 0) >= s.intervalMs;
}

/** Runs a backup + orphan sweep if due. Returns true when it ran. */
export async function runAutoBackupIfDue(now = Date.now()): Promise<boolean> {
  const s = await getAutoBackupSettings();
  if (!isBackupDue(s, now)) return false;
  const backup = await buildBackup({ includeSecrets: false });
  const filename = `localgallery-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
  downloadBackup(backup, filename);
  await sweepOrphanMetadata();
  await setAutoBackupSettings({ lastRunAt: now });
  return true;
}

/**
 * Delete metadata rows (embeddings, faces, ocr) whose assetId no longer exists
 * in the assets table. Keeps IndexedDB lean after purges/trash sweeps.
 * Returns counts per table.
 */
export async function sweepOrphanMetadata(): Promise<{
  embeddings: number;
  faces: number;
  ocr: number;
}> {
  const assetIds = new Set(await photoDb.assets.toCollection().primaryKeys());
  const [embRows, faceRows, ocrRows] = await Promise.all([
    photoDb.embeddings.toArray(),
    photoDb.faces.toArray(),
    photoDb.ocr.toArray(),
  ]);
  const orphanEmb = embRows.filter((r) => !assetIds.has(r.id)).map((r) => r.id);
  const orphanFaces = faceRows.filter((r) => !assetIds.has(r.assetId)).map((r) => r.id);
  const orphanOcr = ocrRows.filter((r) => !assetIds.has(r.id)).map((r) => r.id);
  await photoDb.transaction("rw", photoDb.embeddings, photoDb.faces, photoDb.ocr, async () => {
    if (orphanEmb.length) await photoDb.embeddings.bulkDelete(orphanEmb);
    if (orphanFaces.length) await photoDb.faces.bulkDelete(orphanFaces);
    if (orphanOcr.length) await photoDb.ocr.bulkDelete(orphanOcr);
  });
  return { embeddings: orphanEmb.length, faces: orphanFaces.length, ocr: orphanOcr.length };
}
