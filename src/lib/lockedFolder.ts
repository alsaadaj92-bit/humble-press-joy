// Locked Folder — local PIN-gated visibility. The PIN never leaves the device
// (stored as a PBKDF2 hash in Dexie KV). Unlock is session-only (in-memory).
import { photoDb } from "./photoDb";

const KV_HASH = "locked-folder:pin-hash";
const KV_SALT = "locked-folder:pin-salt";

let sessionUnlocked = false;
const listeners = new Set<(unlocked: boolean) => void>();

function b64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"],
  );
  const saltBuf = new Uint8Array(salt).buffer; // ArrayBuffer copy
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations: 120_000, hash: "SHA-256" },
    key, 256,
  );
  return b64(bits);
}

export async function hasLockedPin(): Promise<boolean> {
  const row = await photoDb.kv.get(KV_HASH);
  return !!row?.value;
}

export async function setLockedPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt);
  await photoDb.kv.bulkPut([
    { key: KV_SALT, value: b64(new Uint8Array(salt).buffer) },
    { key: KV_HASH, value: hash },
  ]);
}

export async function verifyLockedPin(pin: string): Promise<boolean> {
  const [saltRow, hashRow] = await Promise.all([
    photoDb.kv.get(KV_SALT),
    photoDb.kv.get(KV_HASH),
  ]);
  if (!saltRow || !hashRow) return false;
  const hash = await derive(pin, fromB64(saltRow.value));
  return hash === hashRow.value;
}

export function isUnlocked(): boolean {
  return sessionUnlocked;
}

export function lockNow(): void {
  sessionUnlocked = false;
  listeners.forEach((l) => l(false));
}

export async function unlockWith(pin: string): Promise<boolean> {
  const ok = await verifyLockedPin(pin);
  if (ok) {
    sessionUnlocked = true;
    listeners.forEach((l) => l(true));
  }
  return ok;
}

export function subscribeLockState(cb: (unlocked: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Remove the PIN and unlock everything (asks caller for confirmation). */
export async function resetLockedFolder(): Promise<void> {
  await photoDb.kv.bulkDelete([KV_HASH, KV_SALT]);
  // Unlock every currently-locked item.
  const locked = await photoDb.states.where("locked").equals(1).toArray().catch(async () => {
    // fallback if index missing
    return (await photoDb.states.toArray()).filter((s) => s.locked);
  });
  await photoDb.states.bulkPut(locked.map((s) => ({ ...s, locked: false })));
  sessionUnlocked = false;
  listeners.forEach((l) => l(false));
}
