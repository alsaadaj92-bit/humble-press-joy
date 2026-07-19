/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import "fake-indexeddb/auto";

// jsdom lacks crypto.subtle; graft Node's WebCrypto in.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

import {
  setupE2EE,
  unlockE2EE,
  lockE2EE,
  disableE2EE,
  encryptFile,
  decryptBlob,
  isUnlocked,
  isE2EEConfigured,
} from "./crypto";

beforeAll(async () => {
  await disableE2EE();
});

describe("E2EE roundtrip", () => {
  it("encrypts and decrypts a file with the right passphrase", async () => {
    await setupE2EE("correcthorsebatterystaple");
    expect(isUnlocked()).toBe(true);
    expect(await isE2EEConfigured()).toBe(true);

    const original = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])], "test.bin", {
      type: "application/octet-stream",
    });
    const { blob, meta } = await encryptFile(original);
    expect(meta.originalName).toBe("test.bin");
    expect(blob.size).toBeGreaterThan(original.size); // header + GCM tag overhead

    const roundtripped = await decryptBlob(blob, meta);
    const bytes = new Uint8Array(await roundtripped.arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("rejects wrong passphrases", async () => {
    await setupE2EE("hunter2hunter2");
    lockE2EE();
    await expect(unlockE2EE("wrong-pass")).rejects.toThrow(/كلمة السر/);
    await unlockE2EE("hunter2hunter2");
    expect(isUnlocked()).toBe(true);
  });

  it("rejects short passphrases at setup", async () => {
    await disableE2EE();
    await expect(setupE2EE("short")).rejects.toThrow();
  });
});
