import { useEffect } from "react";
import { runAutoBackupIfDue } from "@/lib/autoBackup";

/** Mount once at app root — checks on load, on focus, and hourly. */
export function useAutoBackupLoop(intervalMs = 60 * 60 * 1000) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await runAutoBackupIfDue();
      } catch (err) {
        console.warn("auto-backup failed", err);
      }
    };
    run();
    const id = window.setInterval(() => {
      if (!cancelled) run();
    }, intervalMs);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);
}
