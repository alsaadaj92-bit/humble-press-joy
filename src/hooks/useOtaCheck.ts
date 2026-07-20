import { useEffect, useState } from "react";
import { checkForUpdate, type UpdateInfo } from "@/lib/ota";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export function useOtaCheck() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await checkForUpdate();
      if (!cancelled) setInfo(result);
    };
    void run();
    const t = window.setInterval(run, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const dismiss = () => setDismissed(true);
  return { info, dismissed, dismiss };
}
