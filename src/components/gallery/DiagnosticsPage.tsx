import { ArrowRight } from "lucide-react";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { pushBackHandler } from "@/lib/backStack";
import { useEffect } from "react";

interface Props { onBack: () => void }

export function DiagnosticsPage({ onBack }: Props) {
  useEffect(() => pushBackHandler(() => { onBack(); return true; }), [onBack]);
  return (
    <div className="min-h-screen bg-background text-foreground safe-top" dir="rtl">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
          aria-label="رجوع"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">مراقب الأخطاء</h1>
      </header>
      <div className="mx-auto max-w-2xl p-3 pb-28">
        <DiagnosticsPanel />
      </div>
    </div>
  );
}
