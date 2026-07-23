import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import {
  photoDb,
  DEFAULT_SYNC_SETTINGS,
  type SyncSettings,
} from "@/lib/photoDb";
import {
  getSyncSettings,
  runSyncCycle,
  subscribeSync,
  type SyncProgress,
} from "@/lib/syncEngine";

export function useSyncSettings(): SyncSettings {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  useEffect(() => {
    let alive = true;
    void getSyncSettings().then((s) => alive && setSettings(s));
    const sub = liveQuery(() => photoDb.kv.get("syncSettings")).subscribe({
      next: (raw) => {
        if (!alive) return;
        if (!raw?.value) return setSettings(DEFAULT_SYNC_SETTINGS);
        try { setSettings({ ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(raw.value) }); }
        catch { setSettings(DEFAULT_SYNC_SETTINGS); }
      },
    });
    return () => { alive = false; sub.unsubscribe(); };
  }, []);
  return settings;
}

export function useSyncProgress(): SyncProgress {
  const [p, setP] = useState<SyncProgress>({ running: false, total: 0, done: 0, failed: 0 });
  useEffect(() => subscribeSync(setP), []);
  return p;
}

/** Long-lived sync loop. Mount once. */
export function useSyncLoop() {
  const settings = useSyncSettings();
  useEffect(() => {
    if (settings.paused || settings.mode !== "auto") return;
    const sub = liveQuery(() =>
      photoDb.assets.where("provider").equals("device").count(),
    ).subscribe({
      next: () => { void runSyncCycle(); },
    });
    return () => sub.unsubscribe();
  }, [settings.paused, settings.mode]);

  useEffect(() => {
    const on = () => void runSyncCycle();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
}
