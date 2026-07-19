import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Small status pill: shows "offline" state and an "Install App" button when
 * the browser fires `beforeinstallprompt`. Both are optional and only appear
 * when relevant — no layout impact otherwise.
 */
export function PwaStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const bip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    const installed = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", bip);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", bip);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (online && !installEvt) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      {!online && (
        <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs px-3 py-1.5 backdrop-blur">
          <WifiOff className="w-3.5 h-3.5" />
          دون اتصال — سيُستأنف الرفع تلقائياً
        </span>
      )}
      {installEvt && (
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full shadow-lg"
          onClick={async () => {
            await installEvt.prompt();
            const { outcome } = await installEvt.userChoice;
            if (outcome === "accepted") setInstallEvt(null);
          }}
        >
          <Download className="w-3.5 h-3.5 ml-1" />
          تثبيت التطبيق
        </Button>
      )}
    </div>
  );
}
