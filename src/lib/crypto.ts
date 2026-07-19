// Client-side E2EE for uploads.
// The master key is derived from a user passphrase via PBKDF2 (SHA-256, 250k iter).
// Every file gets its own random AES-GCM 256 key, which is wrapped by the master key.
// The wrapped key + IVs travel inside the encrypted blob header, so even Telegram
// only ever sees ciphertext. The passphrase itself never leaves this device.

import { photoDb } from "./photoDb";

const KV_CONFIG = "e2eeConfig";
const PBKDF2_ITERS = 250_000;
const MAGIC = new Uint8Array([0x4c, 0x47, 0x50, 0x31]); // "LGP1"
const VERIFIER_PLAINTEXT = "localgallery-pro/verify/v1";

interface StoredConfig {
  salt: string;           // base64
  verifierIv: string;     // base64
  verifierCt: string;     // base64 — AES-GCM(masterKey, VERIFIER_PLAINTEXT)
  createdAt: number;
}

// --- session state ---------------------------------------------------------
let sessionKey: CryptoKey | null = null;

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

export function lockE2EE() {
  sessionKey = null;
  emit();
}

// --- base64 helpers --------------------------------------------------------
export function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// WebCrypto's BufferSource typing rejects Uint8Array<ArrayBufferLike> under strict TS.
// Copy into a fresh ArrayBuffer so the type matches everywhere.
function bs(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

// --- key derivation --------------------------------------------------------
async function deriveMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bs(salt), iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}


// --- config (KV) -----------------------------------------------------------
export async function getE2EEConfig(): Promise<StoredConfig | null> {
  const raw = await photoDb.kv.get(KV_CONFIG);
  if (!raw?.value) return null;
  try {
    return JSON.parse(raw.value) as StoredConfig;
  } catch {
    return null;
  }
}
export function isE2EEConfigured(): Promise<boolean> {
  return getE2EEConfig().then((c) => !!c);
}

/** Create a fresh passphrase (first-time setup). Overwrites existing config. */
export async function setupE2EE(passphrase: string): Promise<void> {
  if (passphrase.length < 8) throw new Error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveMasterKey(passphrase, salt);
  const verifierIv = crypto.getRandomValues(new Uint8Array(12));
  const verifierCt = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: verifierIv },
      key,
      new TextEncoder().encode(VERIFIER_PLAINTEXT),
    ),
  );
  const cfg: StoredConfig = {
    salt: b64encode(salt),
    verifierIv: b64encode(verifierIv),
    verifierCt: b64encode(verifierCt),
    createdAt: Date.now(),
  };
  await photoDb.kv.put({ key: KV_CONFIG, value: JSON.stringify(cfg) });
  sessionKey = key;
  emit();
}

export async function unlockE2EE(passphrase: string): Promise<void> {
  const cfg = await getE2EEConfig();
  if (!cfg) throw new Error("لم يتم إعداد التشفير بعد");
  const key = await deriveMasterKey(passphrase, b64decode(cfg.salt));
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bs(b64decode(cfg.verifierIv)) },
      key,
      bs(b64decode(cfg.verifierCt)),
    );

    if (new TextDecoder().decode(pt) !== VERIFIER_PLAINTEXT)
      throw new Error("verifier mismatch");
  } catch {
    throw new Error("كلمة السر غير صحيحة");
  }
  sessionKey = key;
  emit();
}

/** Danger: forgets the passphrase and existing encrypted assets become unreadable. */
export async function disableE2EE(): Promise<void> {
  await photoDb.kv.delete(KV_CONFIG);
  sessionKey = null;
  emit();
}

// --- file encryption -------------------------------------------------------
export interface EncryptionMeta {
  alg: "AES-GCM-256";
  originalName: string;
  originalMime: string;
  originalSize: number;
}

/**
 * Layout of the encrypted blob:
 *   [4]  magic "LGP1"
 *   [1]  version = 1
 *   [1]  reserved
 *   [12] fileIv
 *   [12] wrapIv
 *   [2]  wrappedKeyLen  (little-endian uint16)
 *   [N]  wrappedKey     (AES-GCM(master, rawFileKey))
 *   [..] ciphertext     (AES-GCM(fileKey, plaintext))
 */
export async function encryptFile(file: File): Promise<{ blob: Blob; meta: EncryptionMeta }> {
  if (!sessionKey) throw new Error("التشفير مقفل — افتح القفل أولاً");
  const fileKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawFileKey = new Uint8Array(await crypto.subtle.exportKey("raw", fileKey));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(wrapIv) }, sessionKey, bs(rawFileKey)),
  );
  const fileIv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new Uint8Array(await new Response(file).arrayBuffer());
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(fileIv) }, fileKey, bs(plaintext)),
  );

  const header = new Uint8Array(4 + 1 + 1 + 12 + 12 + 2 + wrappedKey.length);
  header.set(MAGIC, 0);
  header[4] = 1;
  header[5] = 0;
  header.set(fileIv, 6);
  header.set(wrapIv, 18);
  new DataView(header.buffer).setUint16(30, wrappedKey.length, true);
  header.set(wrappedKey, 32);

  const blob = new Blob([header, ciphertext], { type: "application/octet-stream" });
  return {
    blob,
    meta: {
      alg: "AES-GCM-256",
      originalName: file.name,
      originalMime: file.type || "application/octet-stream",
      originalSize: file.size,
    },
  };
}

export async function decryptBlob(encrypted: Blob, meta: EncryptionMeta): Promise<Blob> {
  if (!sessionKey) throw new Error("التشفير مقفل — افتح القفل أولاً");
  const buf = new Uint8Array(await new Response(encrypted).arrayBuffer());

  if (buf.length < 32) throw new Error("ملف مشفّر تالف");
  for (let i = 0; i < 4; i++) {
    if (buf[i] !== MAGIC[i]) throw new Error("ليس ملفاً مشفراً بصيغة LocalGallery");
  }
  const version = buf[4];
  if (version !== 1) throw new Error(`إصدار تشفير غير مدعوم: ${version}`);
  const fileIv = buf.slice(6, 18);
  const wrapIv = buf.slice(18, 30);
  const wrappedKeyLen = new DataView(buf.buffer, buf.byteOffset).getUint16(30, true);
  const headerLen = 32 + wrappedKeyLen;
  const wrappedKey = buf.slice(32, headerLen);
  const ciphertext = buf.slice(headerLen);

  const rawFileKey = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: wrapIv }, sessionKey, wrappedKey),
  );
  const fileKey = await crypto.subtle.importKey(
    "raw",
    rawFileKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fileIv },
    fileKey,
    ciphertext,
  );
  return new Blob([plaintext], { type: meta.originalMime || "application/octet-stream" });
}

// --- subscription for UI ---------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeE2EE(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
