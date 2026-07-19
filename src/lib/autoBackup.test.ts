import { describe, it, expect } from "vitest";
import { isBackupDue, AUTO_BACKUP_INTERVAL_MS } from "./autoBackup";

describe("autoBackup scheduler", () => {
  const base = { intervalMs: AUTO_BACKUP_INTERVAL_MS, lastRunAt: 0, enabled: true };

  it("skips when disabled", () => {
    expect(isBackupDue({ ...base, enabled: false }, 1_000_000_000_000)).toBe(false);
  });

  it("runs on first invocation when enabled", () => {
    expect(isBackupDue(base, 1_000_000_000_000)).toBe(true);
  });

  it("waits until interval elapses", () => {
    const now = 2_000_000_000_000;
    expect(isBackupDue({ ...base, lastRunAt: now - 1000 }, now)).toBe(false);
    expect(isBackupDue({ ...base, lastRunAt: now - AUTO_BACKUP_INTERVAL_MS }, now)).toBe(true);
  });
});
