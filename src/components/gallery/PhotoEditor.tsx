import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Crop as CropIcon,
  Download,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Sliders,
  Sparkles,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  FILTER_PRESETS,
  NEUTRAL_ADJUSTMENTS,
  NEUTRAL_PIPELINE,
  isNeutralPipeline,
  loadImage,
  renderPipeline,
  suggestEditedName,
  toCssFilter,
  type CropRect,
  type EditAdjustments,
  type EditPipeline,
  type FilterPreset,
} from "@/lib/imageEditor";
import { enqueueFiles } from "@/lib/syncEngine";
import { getActiveProviderKind } from "@/lib/providers";

type Tab = "filters" | "adjust" | "crop";

interface PhotoEditorProps {
  src: string;
  fileName: string;
  onClose: () => void;
  /** Optional callback after saving. */
  onSaved?: () => void;
}

const ASPECTS: Array<{ label: string; value: number | null }> = [
  { label: "حر", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
];

export function PhotoEditor({ src, fileName, onClose, onSaved }: PhotoEditorProps) {
  const [pipeline, setPipeline] = useState<EditPipeline>(() => ({
    ...NEUTRAL_PIPELINE,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
  }));
  const [preset, setPreset] = useState<FilterPreset>("none");
  const [tab, setTab] = useState<Tab>("filters");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Load source image once.
  useEffect(() => {
    let alive = true;
    loadImage(src)
      .then((i) => alive && setImg(i))
      .catch((e) => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, [src]);

  const cssFilter = useMemo(() => toCssFilter(pipeline.adjustments), [pipeline.adjustments]);
  const transform = useMemo(() => {
    const scaleX = pipeline.flipH ? -1 : 1;
    const scaleY = pipeline.flipV ? -1 : 1;
    return `rotate(${pipeline.rotate}deg) scale(${scaleX}, ${scaleY})`;
  }, [pipeline.rotate, pipeline.flipH, pipeline.flipV]);

  const updateAdj = (patch: Partial<EditAdjustments>) =>
    setPipeline((p) => ({ ...p, adjustments: { ...p.adjustments, ...patch } }));

  const applyPreset = (p: FilterPreset) => {
    setPreset(p);
    setPipeline((prev) => ({
      ...prev,
      adjustments: { ...NEUTRAL_ADJUSTMENTS, ...FILTER_PRESETS[p] },
    }));
  };

  const resetAll = () =>
    setPipeline({ ...NEUTRAL_PIPELINE, adjustments: { ...NEUTRAL_ADJUSTMENTS } });

  const rotate90 = () =>
    setPipeline((p) => ({
      ...p,
      rotate: (((p.rotate + 90) % 360) as EditPipeline["rotate"]),
    }));

  const doExport = useCallback(
    async (mode: "download" | "upload") => {
      if (!img) return;
      setSaving(true);
      try {
        const blob = await renderPipeline(img, pipeline, {
          mime: "image/jpeg",
          quality: 0.92,
        });
        const outName = suggestEditedName(fileName);
        if (mode === "download") {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = outName;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("تم تنزيل النسخة المعدَّلة");
        } else {
          const provider = await getActiveProviderKind();
          if (!provider) {
            toast.error("لا يوجد مزود نشط — سيتم التنزيل بدلاً من الرفع");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = outName;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            const file = new File([blob], outName, { type: "image/jpeg" });
            await enqueueFiles([file]);
            toast.success("أُضيفت إلى طابور المزامنة");
          }
        }
        onSaved?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل الحفظ");
      } finally {
        setSaving(false);
      }
    },
    [img, pipeline, fileName, onSaved],
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 hover:bg-white/10"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-sm text-white/70">تحرير الصورة</div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={saving || isNeutralPipeline(pipeline)}
            onClick={resetAll}
          >
            إعادة تعيين
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={saving || !img}
            onClick={() => doExport("download")}
          >
            <Download className="ml-1 h-4 w-4" />
            تنزيل
          </Button>
          <Button
            size="sm"
            disabled={saving || !img}
            onClick={() => doExport("upload")}
          >
            <UploadIcon className="ml-1 h-4 w-4" />
            رفع كنسخة جديدة
          </Button>
        </div>
      </div>

      {/* Preview stage */}
      <div
        ref={stageRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#111,transparent_75%)] p-4"
      >
        {img ? (
          <img
            src={src}
            alt={fileName}
            style={{
              filter: cssFilter,
              transform,
              transition: "filter 120ms linear, transform 200ms ease",
            }}
            className="max-h-full max-w-full select-none rounded-md shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="text-white/60">جاري تحميل الصورة…</div>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-t border-white/10 bg-black/70 backdrop-blur">
        <div className="flex justify-around">
          <TabBtn active={tab === "filters"} onClick={() => setTab("filters")} icon={<Sparkles className="h-4 w-4" />}>
            فلاتر
          </TabBtn>
          <TabBtn active={tab === "adjust"} onClick={() => setTab("adjust")} icon={<Sliders className="h-4 w-4" />}>
            تعديلات
          </TabBtn>
          <TabBtn active={tab === "crop"} onClick={() => setTab("crop")} icon={<CropIcon className="h-4 w-4" />}>
            قص وتدوير
          </TabBtn>
        </div>

        <div className="max-h-56 overflow-y-auto px-4 py-3">
          {tab === "filters" && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {(Object.keys(FILTER_PRESETS) as FilterPreset[]).map((p) => (
                <FilterChip
                  key={p}
                  name={p}
                  active={preset === p}
                  src={src}
                  onClick={() => applyPreset(p)}
                />
              ))}
            </div>
          )}

          {tab === "adjust" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SliderRow
                label="السطوع"
                min={0.4}
                max={1.6}
                step={0.01}
                value={pipeline.adjustments.brightness}
                onChange={(v) => updateAdj({ brightness: v })}
              />
              <SliderRow
                label="التباين"
                min={0.4}
                max={1.6}
                step={0.01}
                value={pipeline.adjustments.contrast}
                onChange={(v) => updateAdj({ contrast: v })}
              />
              <SliderRow
                label="التشبع"
                min={0}
                max={2}
                step={0.01}
                value={pipeline.adjustments.saturate}
                onChange={(v) => updateAdj({ saturate: v })}
              />
              <SliderRow
                label="درجة اللون"
                min={0}
                max={360}
                step={1}
                value={pipeline.adjustments.hueRotate}
                onChange={(v) => updateAdj({ hueRotate: v })}
                fmt={(v) => `${Math.round(v)}°`}
              />
              <SliderRow
                label="سيبيا"
                min={0}
                max={1}
                step={0.01}
                value={pipeline.adjustments.sepia}
                onChange={(v) => updateAdj({ sepia: v })}
              />
              <SliderRow
                label="أبيض وأسود"
                min={0}
                max={1}
                step={0.01}
                value={pipeline.adjustments.grayscale}
                onChange={(v) => updateAdj({ grayscale: v })}
              />
            </div>
          )}

          {tab === "crop" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={rotate90}>
                  <RotateCw className="ml-1 h-4 w-4" />
                  تدوير 90°
                </Button>
                <Button
                  size="sm"
                  variant={pipeline.flipH ? "default" : "secondary"}
                  onClick={() => setPipeline((p) => ({ ...p, flipH: !p.flipH }))}
                >
                  <FlipHorizontal className="ml-1 h-4 w-4" />
                  عكس أفقي
                </Button>
                <Button
                  size="sm"
                  variant={pipeline.flipV ? "default" : "secondary"}
                  onClick={() => setPipeline((p) => ({ ...p, flipV: !p.flipV }))}
                >
                  <FlipVertical className="ml-1 h-4 w-4" />
                  عكس رأسي
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-white/60">نسبة القص</div>
                <div className="flex flex-wrap gap-2">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => {
                        setAspect(a.value);
                        setPipeline((p) => ({
                          ...p,
                          crop: cropFromAspect(a.value, img),
                        }));
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition",
                        aspect === a.value
                          ? "border-white bg-white text-black"
                          : "border-white/20 text-white/80 hover:bg-white/10",
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                  {pipeline.crop && (
                    <button
                      onClick={() =>
                        setPipeline((p) => ({ ...p, crop: undefined }))
                      }
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                    >
                      إلغاء القص
                    </button>
                  )}
                </div>
                {pipeline.crop && (
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Check className="h-3.5 w-3.5" />
                    القص مطبَّق ({Math.round(pipeline.crop.width * 100)}% ×
                    {" "}
                    {Math.round(pipeline.crop.height * 100)}%)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cropFromAspect(
  aspect: number | null,
  img: HTMLImageElement | null,
): CropRect | undefined {
  if (!aspect || !img) return undefined;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const imgAspect = w / h;
  let cw: number;
  let ch: number;
  if (imgAspect > aspect) {
    ch = h;
    cw = h * aspect;
  } else {
    cw = w;
    ch = w / aspect;
  }
  return {
    x: (w - cw) / 2 / w,
    y: (h - ch) / 2 / h,
    width: cw / w,
    height: ch / h,
  };
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition",
        active ? "bg-white/10 text-white" : "text-white/60 hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white/50">
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </label>
  );
}

function FilterChip({
  name,
  active,
  src,
  onClick,
}: {
  name: FilterPreset;
  active: boolean;
  src: string;
  onClick: () => void;
}) {
  const style = useMemo(() => {
    const merged = { ...NEUTRAL_ADJUSTMENTS, ...FILTER_PRESETS[name] };
    return { filter: toCssFilter(merged) };
  }, [name]);
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 shrink-0",
        active && "opacity-100",
      )}
    >
      <div
        className={cn(
          "h-16 w-16 overflow-hidden rounded-lg border-2 transition",
          active ? "border-white" : "border-transparent",
        )}
      >
        <img
          src={src}
          alt={name}
          style={style}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
      <span className={cn("text-[11px]", active ? "text-white" : "text-white/60")}>
        {presetLabel(name)}
      </span>
    </button>
  );
}

function presetLabel(name: FilterPreset): string {
  switch (name) {
    case "none":
      return "الأصلية";
    case "mono":
      return "أحادي";
    case "sepia":
      return "سيبيا";
    case "vintage":
      return "قديم";
    case "cool":
      return "بارد";
    case "warm":
      return "دافئ";
    case "vivid":
      return "زاهي";
    case "fade":
      return "خافت";
  }
}
