import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb } from "@/lib/photoDb";
import {
  enqueue,
  subscribeStatus,
  type PipelineStatus,
} from "@/lib/autoPipeline";

/**
 * Mount once at app root. Watches for sync jobs that just transitioned to
 * "done" and pushes their assetId into the AutoPipeline queue.
 */
export function useAutoPipelineLoop() {
  useEffect(() => {
    const seen = new Set<string>();
    const sub = liveQuery(() =>
      photoDb.syncJobs.where("status").equals("done").toArray(),
    ).subscribe({
      next: (jobs) => {
        for (const j of jobs) {
          if (!j.assetId || seen.has(j.id)) continue;
          seen.add(j.id);
          void enqueue(j.assetId);
        }
      },
    });
    return () => sub.unsubscribe();
  }, []);
}

export function useAutoPipelineStatus(): PipelineStatus {
  const [s, setS] = useState<PipelineStatus>({
    running: false,
    processed: 0,
    failed: 0,
    queued: 0,
  });
  useEffect(() => subscribeStatus(setS), []);
  return s;
}
