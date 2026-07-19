// Local trash lifecycle — 30-day auto-expiration, purely client-side.
// Sweeps IndexedDB state entries and (optionally) removes matching MediaAssets.
import { photoDb, type PhotoState, type MediaAsset } from "./photoDb";

export const TRASH_TTL_DAYS = 30;
export const TRASH_TTL_MS = TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface TrashInfo {
  id: string;
  trashedAt: number;
  expiresAt: number;
  msRemaining: number;
  daysRemaining: number;
  expired: boolean;
}

export function trashInfo(state: Pick<PhotoState, "trashedAt">, now = Date.now()): TrashInfo | null {
  if (!state.trashedAt) return null;
  const expiresAt = state.trashedAt + TRASH_TTL_MS;
  const msRemaining = Math.max(0, expiresAt - now);
  return {
    id: "",
    trashedAt: state.trashedAt,
    expiresAt,
    msRemaining,
    daysRemaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    expired: msRemaining <= 0,
  };
}

export function formatRemaining(days: number): string {
  if (days <= 0) return "انتهت المدة";
  if (days === 1) return "يوم واحد متبقٍ";
  if (days === 2) return "يومان متبقيان";
  if (days <= 10) return `${days} أيام متبقية`;
  return `${days} يوماً متبقياً`;
}

/** Pure selector — returns ids whose trashedAt is older than TTL. */
export function selectExpiredIds(
  states: Iterable<PhotoState>,
  now = Date.now(),
): string[] {
  const out: string[] = [];
  for (const s of states) {
    if (s.trashedAt && now - s.trashedAt >= TRASH_TTL_MS) out.push(s.id);
  }
  return out;
}

/** Sweep expired trash: removes state rows and any matching MediaAssets. Returns purged ids. */
export async function sweepExpiredTrash(now = Date.now()): Promise<string[]> {
  const all = await photoDb.states.toArray();
  const expired = selectExpiredIds(all, now);
  if (!expired.length) return [];
  await photoDb.transaction("rw", photoDb.states, photoDb.assets, async () => {
    await photoDb.states.bulkDelete(expired);
    await photoDb.assets.bulkDelete(expired);
  });
  return expired;
}

/** Permanently delete a specific set of ids regardless of TTL. */
export async function purgeIds(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await photoDb.transaction("rw", photoDb.states, photoDb.assets, async () => {
    await photoDb.states.bulkDelete(ids);
    await photoDb.assets.bulkDelete(ids);
  });
}

/** Assets are considered trashed when their id has a state row with trashedAt. */
export function isAssetTrashed(asset: MediaAsset, states: Map<string, PhotoState>): boolean {
  return !!states.get(asset.id)?.trashedAt;
}
