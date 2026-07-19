import { useEffect } from "react";
import { sweepExpiredTrash } from "@/lib/trash";

/** Runs a periodic sweep of expired trash (>30d). Silent — no toasts. */
export function useTrashSweeper(intervalMs = 60 * 60 * 1000) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await sweepExpiredTrash();
      } catch (err) {
        console.warn("trash sweep failed", err);
      }
    };
    run();
    const id = window.setInterval(() => {
      if (!cancelled) run();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);
}
