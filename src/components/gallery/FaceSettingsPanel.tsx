import { useEffect, useState } from "react";
import { Loader2, Zap, Target, RefreshCw, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useFaceSettings,
  setFaceSettings,
  type FaceProcessingMode,
} from "@/lib/faceSettings";
import {
  faceScanStats,
  loadFaceModels,
  resetFaceModels,
  subscribeFaceModelStatus,
  type FaceModelStatus,
} from "@/lib/faces";
import { photoDb } from "@/lib/photoDb";
import { backfillMissing } from "@/lib/autoPipeline";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";

/**
 * Face pipeline control surface — mode (GPU/CPU), preview toggle,
 * clustering threshold, re-index, live model status + timing stats.
 */
export function FaceSettingsPanel() {
  const settings = useFaceSettings();
  const [status, setStatus] = useState<FaceModelStatus>({ status: "idle", progress: 0 });
  const [stats, setStats] = useState({ scanned: 0, faces: 0, averageMs: 0 });
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    const unsub = subscribeFaceModelStatus(setStatus);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await faceScanStats();
      if (alive) setStats(s);
    };
    void tick();
    const iv = window.setInterval(tick, 4000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, []);

  const switchMode = async (mode: FaceProcessingMode) => {
    await setFaceSettings({ mode });
    await resetFaceModels();
    toast.success(mode === "fast" ? "الوضع السريع (GPU إن أمكن)" : "الوضع الدقيق (CPU)");
  };

  const reindex = async () => {
    if (reindexing) return;
    if (!(await confirmDialog({ title: "إعادة فهرسة الوجوه", message: "سيتم إعادة فحص جميع الصور بنموذج الوجوه الحالي. متابعة؟" }))) return;
    setReindexing(true);
    try {
      // Force face-scan recompute by wiping cache markers only.
      const kvs = await photoDb.kv.toArray();
      const stale = kvs.filter((r) => r.key.startsWith("faceScan:")).map((r) => r.key);
      if (stale.length) await photoDb.kv.bulkDelete(stale);
      await loadFaceModels();
      const queued = await backfillMissing(2000);
      toast.success(`أُدرجت ${queued} صورة لإعادة الفهرسة`);
    } catch (e) {
      toast.error("فشلت إعادة الفهرسة", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setReindexing(false);
    }
  };

  const preload = async () => {
    try {
      await loadFaceModels();
      toast.success("النموذج جاهز — يعمل بلا إنترنت الآن");
    } catch (e) {
      toast.error("تعذّر التحميل", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const busy = status.status === "loading";
  const ready = status.status === "ready";

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
      {/* Mode */}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4 text-primary" /> وضع المعالجة
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["fast", "accurate"] as FaceProcessingMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                settings.mode === m
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary/50 hover:bg-secondary",
              )}
            >
              {m === "fast" ? "سريع · GPU" : "دقيق · CPU"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          السريع يستخدم GPU-delegate عند توفّره ويعود تلقائياً إلى CPU. الدقيق أبطأ لكنه يقلّل الخطأ.
        </p>
      </div>

      {/* Preview boxes */}
      <div className="flex items-center justify-between gap-4 p-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            {settings.previewBoxes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            رسم مربعات الوجوه
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            يُظهر إطاراً حول كل وجه أثناء المراجعة — أطفئه لأداء أفضل.
          </p>
        </div>
        <button
          onClick={() => setFaceSettings({ previewBoxes: !settings.previewBoxes })}
          className={cn(
            "relative h-6 w-11 rounded-full transition",
            settings.previewBoxes ? "bg-primary" : "bg-secondary",
          )}
          aria-pressed={settings.previewBoxes}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition",
              settings.previewBoxes ? "right-0.5" : "right-5",
            )}
          />
        </button>
      </div>

      {/* Threshold */}
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> عتبة التجميع
          </span>
          <span dir="ltr" className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono">
            {settings.clusterThreshold.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0.9}
          max={0.99}
          step={0.01}
          value={settings.clusterThreshold}
          onChange={(e) => setFaceSettings({ clusterThreshold: Number(e.target.value) })}
          className="w-full accent-primary"
          dir="ltr"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          أقل ⇒ مجموعات أكثر (يفصل الأشباه). أعلى ⇒ مجموعات أوسع (يدمج). الافتراضي 0.95.
        </p>
      </div>

      {/* Model status */}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> حالة النموذج
        </div>
        <div className="rounded-xl bg-secondary/60 p-3 text-xs">
          {busy && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              جاري تحميل {status.stage === "wasm" ? "المحرّك" : status.stage === "embedder" ? "المضمّن" : "الكاشف"}…
              <span className="mx-auto tabular-nums">{Math.round(status.progress * 100)}%</span>
            </div>
          )}
          {!busy && ready && (
            <div className="flex items-center justify-between">
              <span className="text-primary">جاهز · {status.mode === "fast" ? "GPU سريع" : "CPU دقيق"}</span>
              <button onClick={resetFaceModels} className="text-muted-foreground hover:text-foreground">
                إعادة تهيئة
              </button>
            </div>
          )}
          {!busy && !ready && (
            <button onClick={preload} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
              تحميل النموذج للاستخدام دون إنترنت
            </button>
          )}
          {status.status === "error" && (
            <p className="mt-1 text-destructive">{status.message}</p>
          )}
          {busy && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(status.progress * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Stats + reindex */}
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="مفحوصة" value={stats.scanned} />
          <Stat label="وجوه" value={stats.faces} />
          <Stat label="مللي/صورة" value={stats.averageMs} />
        </div>
        <button
          onClick={reindex}
          disabled={reindexing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 py-2 text-xs font-semibold transition hover:bg-secondary disabled:opacity-50"
        >
          {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          إعادة فهرسة الوجوه لكل الصور
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-2">
      <div className="text-sm font-bold tabular-nums">{value.toLocaleString("ar")}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
