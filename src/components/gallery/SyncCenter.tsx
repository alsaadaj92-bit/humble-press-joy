import {
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Wifi,
  AlertCircle,
  ListChecks,
  Zap,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSyncJobs, useSyncSettings } from "@/hooks/useSyncEngine";
import { useProviders } from "@/hooks/useProviders";
import {
  clearCompleted,
  removeJob,
  retryAllFailed,
  retryJob,
  runSyncCycle,
  setSyncSettings,
} from "@/lib/syncEngine";
import type { SyncJob, SyncMode } from "@/lib/photoDb";
import { cn } from "@/lib/utils";

export function SyncCenter() {
  const jobs = useSyncJobs();
  const settings = useSyncSettings();
  const { active } = useProviders();

  const counts = jobs.reduce(
    (acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const runNow = async () => {
    const { processed, failed } = await runSyncCycle();
    toast.success(`تمت جولة مزامنة`, {
      description: `تم رفع ${processed}${failed ? ` · فشل ${failed}` : ""}`,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">مركز المزامنة</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              طابور محلي يرفع صورك تلقائياً إلى مزودك النشط
              {active ? <> — حالياً: <b className="text-foreground">{labelOf(active)}</b></> : " (لا يوجد مزود نشط)"}.
              كل شيء يبقى في متصفحك حتى لحظة الرفع للمزود الذي اخترته.
            </p>
          </div>
          <button
            onClick={() => setSyncSettings({ paused: !settings.paused })}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
              settings.paused
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-accent",
            )}
          >
            {settings.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {settings.paused ? "استئناف" : "إيقاف مؤقت"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Stat label="بانتظار" value={counts.pending ?? 0} tone="muted" />
          <Stat label="جارٍ" value={counts.uploading ?? 0} tone="primary" />
          <Stat label="تم" value={counts.done ?? 0} tone="success" />
          <Stat label="فشل" value={counts.failed ?? 0} tone="danger" />
        </div>
      </header>

      {/* Settings */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">إعدادات المزامنة التلقائية</h2>

        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground/80">وضع المزامنة</span>
          <div className="grid gap-2 sm:grid-cols-3">
            <ModeCard
              current={settings.mode}
              value="manual"
              title="يدوي"
              desc="لا شيء يُرفع تلقائياً. اضغط 'شغّل الآن' متى شئت."
            />
            <ModeCard
              current={settings.mode}
              value="auto-on-import"
              title="عند الاستيراد"
              desc="يبدأ الرفع فور اختيار الملفات."
            />
            <ModeCard
              current={settings.mode}
              value="auto-interval"
              title="بفواصل زمنية"
              desc="يفحص الطابور دورياً حسب المدة."
            />
          </div>
        </div>

        {settings.mode === "auto-interval" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">كل كم دقيقة؟</span>
            <select
              value={settings.intervalMinutes}
              onChange={(e) => setSyncSettings({ intervalMinutes: Number(e.target.value) })}
              className="input-field w-40"
            >
              {[5, 15, 30, 60, 120].map((m) => (
                <option key={m} value={m}>
                  كل {m} دقيقة
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
            <span className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              الرفع على الواي-فاي فقط
            </span>
            <input
              type="checkbox"
              checked={settings.wifiOnly}
              onChange={(e) => setSyncSettings({ wifiOnly: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
            <span>الحد الأقصى لحجم الملف (MB)</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={settings.maxFileMb}
              onChange={(e) =>
                setSyncSettings({ maxFileMb: Math.max(1, Number(e.target.value) || 200) })
              }
              className="input-field w-24 text-right"
              dir="ltr"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            جودة الرفع
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            اختر كيف تُرفع صورك. الضغط يتم محلياً في متصفحك (Canvas) — لا شيء
            يغادر جهازك قبل الترميز. الفيديو لا يُضغط.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <PresetCard
              current={currentPreset(settings)}
              value="original"
              title="الملف الأصلي"
              desc="لا ضغط. أعلى جودة، أكبر حجم."
            />
            <PresetCard
              current={currentPreset(settings)}
              value="high"
              title="جودة عالية"
              desc="WebP 90% · حتى 3840px. ضغط خفيف."
            />
            <PresetCard
              current={currentPreset(settings)}
              value="balanced"
              title="متوازن (موصى به)"
              desc="WebP 82% · حتى 2560px. توازن بين الجودة والحجم."
            />
            <PresetCard
              current={currentPreset(settings)}
              value="small"
              title="حجم صغير"
              desc="WebP 65% · حتى 1600px. أصغر ما يمكن."
            />
          </div>

          <details className="rounded-lg border border-border/60 bg-background/30 p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground/80">
              إعدادات متقدمة
            </summary>
            <div className="mt-3 space-y-3">
              <label className="flex items-center justify-between gap-3 text-xs">
                <span>تفعيل الضغط يدوياً</span>
                <input
                  type="checkbox"
                  checked={settings.compressEnabled}
                  onChange={(e) => setSyncSettings({ compressEnabled: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
              </label>
              {settings.compressEnabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="mb-1 block text-foreground/80">الصيغة</span>
                    <select
                      value={settings.compressFormat}
                      onChange={(e) =>
                        setSyncSettings({
                          compressFormat: e.target.value as "webp" | "jpeg" | "original",
                        })
                      }
                      className="input-field w-full"
                    >
                      <option value="webp">WebP (موصى به)</option>
                      <option value="jpeg">JPEG</option>
                      <option value="original">إبقاء الصيغة الأصلية</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-foreground/80">
                      الجودة ({Math.round(settings.compressQuality * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={Math.round(settings.compressQuality * 100)}
                      onChange={(e) =>
                        setSyncSettings({ compressQuality: Number(e.target.value) / 100 })
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-foreground/80">أقصى بُعد (px)</span>
                    <input
                      type="number"
                      min={0}
                      max={8000}
                      value={settings.compressMaxDim}
                      onChange={(e) =>
                        setSyncSettings({ compressMaxDim: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="input-field w-full"
                      dir="ltr"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-foreground/80">
                      تجاوز الملفات الأصغر من (KB)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={settings.compressSkipUnderKb}
                      onChange={(e) =>
                        setSyncSettings({
                          compressSkipUnderKb: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="input-field w-full"
                      dir="ltr"
                    />
                  </label>
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="flex flex-wrap gap-2">

          <button onClick={runNow} className="btn-primary">
            <Zap className="h-4 w-4" />
            <span>شغّل الآن</span>
          </button>
          <button onClick={() => retryAllFailed()} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            <span>إعادة محاولة الفاشلة</span>
          </button>
          <button onClick={() => clearCompleted()} className="btn-secondary">
            <ListChecks className="h-4 w-4" />
            <span>مسح المكتملة من الطابور</span>
          </button>
        </div>
      </section>

      {/* Android roadmap teaser */}
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 text-xs leading-relaxed">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
          <Smartphone className="h-4 w-4" />
          خارطة تطبيق الأندرويد
        </div>
        <p className="text-foreground/85">
          البنية الحالية معزولة خلف واجهات المزوّدين ومحرك المزامنة، وسنغلّفها لاحقاً بـ <b>Capacitor</b>
          للحصول على: صلاحيات الوصول للمعرض، مزامنة في الخلفية (Background Fetch/WorkManager)،
          إشعارات نظامية عند إكمال الرفع، ومراقبة نوع الشبكة. كل ذلك دون أي سحابة —
          الجهاز → المزوّد الذي تختاره مباشرة.
        </p>
      </section>

      {/* Job list */}
      <section className="space-y-2 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">الطابور ({jobs.length})</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
            الطابور فارغ. أضف صوراً من زر «رفع» وستظهر هنا.
          </p>
        ) : (
          <ul className="scrollbar-thin max-h-[50vh] space-y-2 overflow-y-auto">
            {jobs.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function labelOf(k: string) {
  if (k === "telegram") return "تيليجرام";
  if (k === "localServer") return "الخادم المحلي";
  return k;
}

function ModeCard({
  current,
  value,
  title,
  desc,
}: {
  current: SyncMode;
  value: SyncMode;
  title: string;
  desc: string;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => setSyncSettings({ mode: value })}
      className={cn(
        "space-y-1 rounded-xl border p-3 text-start transition",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-secondary/30 hover:bg-secondary/60",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
        <span>{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "primary" | "success" | "danger";
}) {
  const cls = {
    muted: "bg-secondary text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-emerald-500/15 text-emerald-400",
    danger: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <span className={cn("rounded-full px-3 py-1 font-medium", cls)}>
      {label}: {value}
    </span>
  );
}

function JobRow({ job }: { job: SyncJob }) {
  const status = job.status;
  return (
    <li className="rounded-xl border border-border/60 bg-secondary/30 p-3">
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.fileName}</p>
          <p className="text-[11px] text-muted-foreground">
            {(job.fileSize / 1024 / 1024).toFixed(2)} MB · {labelOf(job.provider)}
            {job.attempts > 0 && <> · محاولات: {job.attempts}</>}
          </p>
          {job.lastError && (
            <p className="mt-1 text-[11px] text-destructive">{job.lastError}</p>
          )}
        </div>
        <div className="flex gap-1">
          {(status === "failed" || status === "pending") && (
            <button
              onClick={() => retryJob(job.id)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              title="إعادة"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {status !== "uploading" && (
            <button
              onClick={() => removeJob(job.id)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              title="إزالة"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: SyncJob["status"] }) {
  if (status === "uploading")
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "failed") return <AlertCircle className="h-5 w-5 text-destructive" />;
  return <div className="h-2 w-2 rounded-full bg-muted-foreground/60" />;
}
