import { useMemo, useState } from "react";
import { Film, Grid3x3, Sparkles, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MockPhoto } from "@/lib/mockPhotos";
import {
  buildCollage,
  buildMovie,
  buildAnimation,
  type CreationKind,
} from "@/lib/creations";

interface Props {
  photos: MockPhoto[];
}

const KIND_META: Record<CreationKind, { title: string; desc: string; icon: typeof Film; ext: string }> = {
  collage: { title: "مجمّعة", desc: "شبكة من صورك في صورة واحدة PNG.", icon: Grid3x3, ext: "png" },
  movie: { title: "فيلم قصير", desc: "فيديو WebM بحركة كن-برنز وانتقالات.", icon: Film, ext: "webm" },
  animation: { title: "متحركة", desc: "حلقة فيديو قصيرة تشبه GIF.", icon: Sparkles, ext: "webm" },
};

export function CreationsPanel({ photos }: Props) {
  const [kind, setKind] = useState<CreationKind>("collage");
  const [count, setCount] = useState(9);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<{ url: string; kind: CreationKind } | null>(null);

  const candidates = useMemo(
    () => photos.filter((p) => p.kind !== "video").slice(0, 80),
    [photos],
  );

  const chosen = useMemo(() => {
    if (selected.size > 0) return candidates.filter((p) => selected.has(p.id));
    return candidates.slice(0, count);
  }, [candidates, selected, count]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const generate = async () => {
    if (chosen.length < 2) {
      toast.error("اختر صورتين على الأقل");
      return;
    }
    setBusy(true);
    setProgress(0);
    if (output) URL.revokeObjectURL(output.url);
    setOutput(null);
    try {
      let blob: Blob;
      if (kind === "collage") {
        blob = await buildCollage(chosen);
      } else if (kind === "movie") {
        blob = await buildMovie(chosen, {}, setProgress);
      } else {
        blob = await buildAnimation(chosen, {}, setProgress);
      }
      const url = URL.createObjectURL(blob);
      setOutput({ url, kind });
      toast.success("تم الإنشاء محلياً — لا شيء غادر جهازك");
    } catch (e) {
      toast.error("فشل الإنشاء: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const download = () => {
    if (!output) return;
    const a = document.createElement("a");
    a.href = output.url;
    a.download = `creation-${Date.now()}.${KIND_META[output.kind].ext}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(KIND_META) as CreationKind[]).map((k) => {
          const Meta = KIND_META[k];
          const Icon = Meta.icon;
          const active = kind === k;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={
                "rounded-2xl border p-4 text-right transition " +
                (active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent")
              }
            >
              <Icon className="mb-2 h-6 w-6" />
              <div className="font-semibold">{Meta.title}</div>
              <div className="text-xs text-muted-foreground">{Meta.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <label className="text-sm text-muted-foreground">عدد الصور الافتراضي:</label>
        <input
          type="range"
          min={2}
          max={Math.min(20, candidates.length)}
          value={Math.min(count, candidates.length)}
          onChange={(e) => setCount(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-8 text-center text-sm">{Math.min(count, candidates.length)}</span>
        <button
          onClick={() => setSelected(new Set())}
          className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/80"
        >
          إلغاء تحديد كل الصور
        </button>
        <button
          onClick={generate}
          disabled={busy}
          className="mr-auto flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? `جارِ الإنشاء… ${Math.round(progress * 100)}%` : "أنشئ محلياً"}
        </button>
      </div>

      {output && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">النتيجة</h3>
            <button
              onClick={download}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" /> تنزيل
            </button>
          </div>
          {output.kind === "collage" ? (
            <img src={output.url} alt="collage" className="mx-auto max-h-[70vh] rounded-lg" />
          ) : (
            <video
              src={output.url}
              controls
              autoPlay
              loop={output.kind === "animation"}
              className="mx-auto max-h-[70vh] rounded-lg"
            />
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          اختر صوراً محددة (اختياري — {selected.size || `أول ${Math.min(count, candidates.length)}`}):
        </h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {candidates.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={
                  "relative aspect-square overflow-hidden rounded-lg ring-2 transition " +
                  (isSel ? "ring-primary" : "ring-transparent hover:ring-border")
                }
              >
                <img
                  src={p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/200`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {isSel && (
                  <div className="absolute inset-0 bg-primary/25" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
