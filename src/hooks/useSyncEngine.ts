import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import {
  photoDb,
  DEFAULT_SYNC_SETTINGS,
  type SyncJob,
  type SyncSettings,
} from "@/lib/photoDb";
import { getSyncSettings, runSyncCycle } from "@/lib/syncEngine";

export function useSyncJobs() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  useEffect(() => {
    const s = liveQuery(() =>
      photoDb.syncJobs.orderBy("createdAt").reverse().toArray(),
    ).subscribe({ next: setJobs });
    return () => s.unsubscribe();
  }, []);
  return jobs;
}

export function useSyncSettings() {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  useEffect(() => {
    let alive = true;
    getSyncSettings().then((s) => alive && setSettings(s));
    const sub = liveQuery(() => photoDb.kv.get("syncSettings")).subscribe({
      next: (raw) => {
        if (!alive) return;
        if (!raw?.value) return setSettings(DEFAULT_SYNC_SETTINGS);
        try {
          setSettings({ ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(raw.value) });
        } catch {
          setSettings(DEFAULT_SYNC_SETTINGS);
        }
      },
    });
    return () => {
      alive = false;
      sub.unsubscribe();
    };
  }, []);
  return settings;
}

/**
 * Long-lived sync loop. Mount once at the app root.
 * - Reacts to online/offline events.
 * - Runs immediately when a new pending job appears (auto-on-import).
 * - Periodically runs at the configured interval (auto-interval).
 */
export function useSyncLoop() {
  const settings = useSyncSettings();

  // Trigger on new pending jobs when auto-on-import
  useEffect(() => {
    if (settings.paused) return;
    if (settings.mode === "manual") return;
    const sub = liveQuery(() =>
      photoDb.syncJobs.where("status").equals("pending").count(),
    ).subscribe({
      next: (n) => {
        if (n > 0) void runSyncCycle();
      },
    });
    return () => sub.unsubscribe();
  }, [settings.paused, settings.mode]);

  // Interval mode
  useEffect(() => {
    if (settings.paused) return;
    if (settings.mode !== "auto-interval") return;
    const ms = Math.max(1, settings.intervalMinutes) * 60_000;
    const t = window.setInterval(() => void runSyncCycle(), ms);
    return () => window.clearInterval(t);
  }, [settings.paused, settings.mode, settings.intervalMinutes]);

  // Re-run on online
  useEffect(() => {
    const on = () => void runSyncCycle();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
}
