import { useEffect, useState } from "react";
import { Camera, Bell, MapPin, Images, Sparkles, Shield, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  isNative,
  prefGet,
  prefSet,
  requestCameraPermission,
  requestLocationPermission,
  requestNotifPermission,
  checkNotifPermission,
  checkGalleryPermission,
} from "@/lib/native";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";
import { preloadInBackground } from "@/lib/preloadModels";


const KEY = "lp:wizard:done";

interface FeatureToggle {
  id: string;
  label: string;
  desc: string;
  icon: typeof Camera;
  default: boolean;
}
const FEATURES: FeatureToggle[] = [
  { id: "autoScan", label: "الفحص التلقائي للمعرض", desc: "اقرأ كل صور جهازك تلقائياً عند فتح التطبيق.", icon: Images, default: true },
  { id: "autoBackup", label: "النسخ الاحتياطي التلقائي", desc: "احفظ نسخة أسبوعية من بيانات المكتبة.", icon: Shield, default: true },
  { id: "aiPipeline", label: "التنظيم الذكي (AI محلي)", desc: "الوجوه + التصنيف + OCR + البحث الدلالي — كله داخل جهازك.", icon: Sparkles, default: true },
  { id: "autoSync", label: "المزامنة التلقائية", desc: "ارفع الصور الجديدة تلقائياً لمزوّدك (تيليجرام/خادم محلي).", icon: Bell, default: false },
];

export function PermissionsWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURES.map((f) => [f.id, f.default])),
  );

  useEffect(() => {
    void (async () => {
      // Re-open the wizard on every launch until the user has actually granted
      // the two critical permissions (gallery + notifications). "Skipped" no
      // longer suppresses it — silent failures are exactly what got us stuck
      // with an empty gallery for weeks.
      if (!isNative()) {
        const done = await prefGet(KEY);
        if (!done) setOpen(true);
        return;
      }
      try {
        const [g, n] = await Promise.all([checkGalleryPermission(), checkNotifPermission()]);
        if (g !== "granted" || n !== "granted") setOpen(true);
      } catch {
        setOpen(true);
      }
    })();
  }, []);

  if (!open) return null;

  const skip = async () => {
    await prefSet(KEY, "skipped");
    setOpen(false);
  };

  const finish = async () => {
    setBusy(true);
    try {
      if (isNative()) {
        // Ask camera + notif + location up-front. Gallery is requested by the
        // actual import call (Camera.pickImages) so the OS shows its picker.
        await Promise.allSettled([
          requestCameraPermission(),
          requestNotifPermission(),
          requestLocationPermission(),
        ]);
      } else if ("Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
      for (const [k, v] of Object.entries(flags)) {
        await prefSet(`lp:flag:${k}`, v ? "1" : "0");
      }
      await prefSet(KEY, "1");
      toast.success("تم إعداد التطبيق — أهلاً بك!");
      // Kick off the OS multi-select right now if user wants gallery import.
      if (flags.autoScan && canScanDeviceGallery()) {
        void scanDeviceGallery().catch(() => undefined);
      }
      if (flags.aiPipeline) preloadInBackground();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground safe-top safe-bottom">
      {/* Progress */}
      <div className="flex items-center gap-2 px-5 pt-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {step === 0 && (
          <div className="mx-auto max-w-md space-y-6 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary/15">
              <Images className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مرحباً بك في Localphotos Pro</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                معرض صور خاص بك — بدون سحابة، بدون تعقّب. صورك تبقى على جهازك، أو على تيليجرام/خادمك بإرادتك.
              </p>
            </div>
            <div className="grid gap-3 text-right">
              <BenefitRow icon={Shield} title="خصوصية مطلقة" desc="لا يُرسل أي شيء لأي خادم إلاّ أنت تفعّل ذلك." />
              <BenefitRow icon={Sparkles} title="ذكاء اصطناعي محلي" desc="التصنيف، الوجوه، OCR — كلها تعمل داخل جهازك." />
              <BenefitRow icon={Bell} title="نسخ احتياطي مرن" setups="تيليجرام، خادم محلي، أو نظام الملفات." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">الأذونات المطلوبة</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                سيسألك النظام عن كل إذن — امنحها ليعمل التطبيق كما يعمل Google Photos.
              </p>
            </div>
            <div className="space-y-2">
              <PermRow icon={Images} title="الصور والفيديوهات" desc="لعرض معرض هاتفك كاملاً داخل التطبيق." />
              <PermRow icon={Camera} title="الكاميرا" desc="لتصوير صور جديدة مباشرة من التطبيق." />
              <PermRow icon={Bell} title="الإشعارات" desc="لإعلامك عند انتهاء النسخ الاحتياطي والمزامنة." />
              <PermRow icon={MapPin} title="الموقع" desc="لعرض تفاصيل GPS للصور على الخريطة." />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">الميزات التلقائية</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                فعّل ما يعمل تلقائياً في الخلفية — يمكنك تغييرها في أي وقت من الإعدادات.
              </p>
            </div>
            <div className="space-y-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                const on = flags[f.id];
                return (
                  <button
                    key={f.id}
                    onClick={() => setFlags((s) => ({ ...s, [f.id]: !s[f.id] }))}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right transition hover:bg-accent"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{f.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                    <div className={cn(
                      "grid h-6 w-11 shrink-0 items-center rounded-full transition",
                      on ? "bg-primary" : "bg-muted",
                    )}>
                      <span className={cn(
                        "block h-5 w-5 rounded-full bg-white shadow transition-transform",
                        on ? "-translate-x-0.5" : "-translate-x-[22px]",
                      )} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <button
          onClick={skip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          تخطّي
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground hover:bg-accent"
              aria-label="السابق"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              التالي
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={finish}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> ابدأ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ icon: Icon, title, desc, setups }: { icon: typeof Camera; title: string; desc?: string; setups?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc ?? setups}</p>
      </div>
    </div>
  );
}

function PermRow({ icon: Icon, title, desc }: { icon: typeof Camera; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
