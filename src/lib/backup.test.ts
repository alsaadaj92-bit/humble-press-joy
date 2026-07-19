import { describe, it, expect } from "vitest";
import {
  BACKUP_VERSION,
  isBackupFile,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from "./backup";

function sample(over: Partial<BackupFile> = {}): BackupFile {
  return {
    app: "localgallery-pro",
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_000_000,
    includesSecrets: false,
    counts: { states: 0, assets: 0, albums: 0, topicRules: 0, providers: 0 },
    data: { states: [], assets: [], albums: [], topicRules: [], providers: [], kv: [] },
    ...over,
  };
}

describe("isBackupFile", () => {
  it("accepts a valid shape", () => {
    expect(isBackupFile(sample())).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isBackupFile(null)).toBe(false);
    expect(isBackupFile({})).toBe(false);
    expect(isBackupFile({ app: "other", version: 1, data: {} })).toBe(false);
  });
});

describe("parseBackup", () => {
  it("round-trips serialize + parse", async () => {
    const b = sample();
    const text = serializeBackup(b);
    const back = await parseBackup(text);
    expect(back.exportedAt).toBe(b.exportedAt);
    expect(back.data.states).toEqual([]);
  });

  it("rejects broken JSON", async () => {
    await expect(parseBackup("not json")).rejects.toThrow(/غير صالح/);
  });

  it("rejects foreign files", async () => {
    await expect(parseBackup(JSON.stringify({ hello: "world" }))).rejects.toThrow(/LocalGallery/);
  });

  it("rejects newer backup versions", async () => {
    const text = serializeBackup(sample({ version: BACKUP_VERSION + 5 }));
    await expect(parseBackup(text)).rejects.toThrow(/أحدث/);
  });
});
