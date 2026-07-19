import { useEffect, useRef } from "react";
import { liveQuery } from "dexie";
import { photoDb, type SyncJob } from "@/lib/photoDb";
import { notify } from "@/lib/native";

// Watches the local sync queue and pings a native/web notification when a
// batch of uploads completes — mirrors the "Backup complete" toast Google
// Photos shows. All state lives in IndexedDB; nothing hits the network here.
export function useSyncNotifications() {
  const lastPending = useRef<number | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => photoDb.syncJobs.toArray()).subscribe({
      next: (jobs: SyncJob[]) => {
        const pending = jobs.filter((j) => j.status === "pending" || j.status === "uploading").length;
        const done = jobs.filter((j) => j.status === "done").length;
        const failed = jobs.filter((j) => j.status === "failed").length;
        const prev = lastPending.current;
        if (prev !== null && prev > 0 && pending === 0) {
          if (failed > 0) {
            void notify("انتهت المزامنة مع أخطاء", `${done} نجحت · ${failed} فشلت`);
          } else if (done > 0) {
            void notify("اكتمل النسخ الاحتياطي", `تمت مزامنة ${done} عنصر بدون أخطاء`);
          }
        }
        lastPending.current = pending;
      },
    });
    return () => sub.unsubscribe();
  }, []);
}
