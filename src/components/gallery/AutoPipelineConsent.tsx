import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent, backfillMissing } from "@/lib/autoPipeline";
import { toast } from "sonner";

/**
 * Non-blocking bottom banner. Shown once per browser profile — if the user
 * grants consent, the AutoPipeline runs silently for every future upload and
 * we also kick off a backfill for any existing assets.
 */
export function AutoPipelineConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getConsent().then((c) => {
      if (alive && c === "unset") setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const grant = async () => {
    await setConsent("granted");
    setOpen(false);
    toast.success("تم تفعيل المعالجة التلقائية");
    // Backfill everything, not just the most recent 100 — the pipeline is
    // idempotent so a big number is safe.
    const n = await backfillMissing(10000);
    if (n > 0) toast.message(`جاري معالجة ${n} صورة موجودة في الخلفية`);
  };

  const deny = async () => {
    await setConsent("denied");
    setOpen(false);
    toast.message("يمكنك تفعيلها لاحقاً من الإعدادات", { duration: 3000 });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-40 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      role="dialog"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">تفعيل الذكاء التلقائي المحلي</p>
              <button
                onClick={deny}
                aria-label="إغلاق"
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              OCR عربي/إنجليزي، بحث دلالي (CLIP)، وكشف الوجوه — يعمل كله داخل جهازك.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              لا يُرسل شيء لأي خادم خارجي.
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={grant} className="flex-1">
                <Sparkles className="ml-1.5 h-4 w-4" /> تفعيل
              </Button>
              <Button size="sm" variant="outline" onClick={deny}>
                ليس الآن
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
