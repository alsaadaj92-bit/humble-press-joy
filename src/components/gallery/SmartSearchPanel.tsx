import { useEffect, useMemo, useState } from "react";
import { Brain, Loader2, Sparkles, Trash2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import type { MockPhoto } from "@/lib/mockPhotos";
import { picsumThumb } from "@/lib/mockPhotos";
import {
  allEmbeddings,
  clearEmbeddings,
  countEmbeddings,
  embedImageFromUrl,
  embedText,
  loadClip,
  putEmbedding,
  cosine,
} from "@/lib/semantic";
import { PhotoGrid } from "./PhotoGrid";
import type { PhotoState } from "@/lib/photoDb";

interface Props {
  photos: MockPhoto[];
  states: Map<string, PhotoState>;
  onOpen: (index: number | null) => void;
}

const EXAMPLES = [
  "غروب على الشاطئ",
  "قطة تنام",
  "طعام على الطاولة",
  "جبال مغطاة بالثلج",
  "صورة سيلفي في الشارع",
  "زهور ملونة",
];

export function SmartSearchPanel({ photos, states, onOpen }: Props) {
  const [indexed, setIndexed] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [cancelReq, setCancelReq] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; score: number }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void countEmbeddings().then(setIndexed);
  }, [running]);

  const eligible = useMemo(
    () => photos.filter((p) => p.kind !== "video"),
    [photos],
  );
  const missingCount = useMemo(async () => 0, []);

  async function ensureModel() {
    if (modelReady) return;
    setModelLoading(true);
    try {
      await loadClip((p: any) => {
        if (p?.status === "progress" && p?.file) {
          setModelProgress(
            `${p.file} · ${(p.progress ?? 0).toFixed(0)}%`,
          );
        } else if (p?.status) {
          setModelProgress(p.status);
        }
      });
      setModelReady(true);
      setModelProgress("");
    } catch (err) {
      toast.error("تعذّر تحميل نموذج CLIP");
      console.error(err);
      throw err;
    } finally {
      setModelLoading(false);
    }
  }

  async function buildIndex() {
    if (running) return;
    setRunning(true);
    setCancelReq(false);
    try {
      await ensureModel();
      const existing = new Set(
        (await allEmbeddings()).map((e) => e.id),
      );
      const todo = eligible.filter((p) => !existing.has(p.id));
      setProgress({ done: 0, total: todo.length });
      if (todo.length === 0) {
        toast.info("الفهرس محدّث بالفعل");
        return;
      }
      let done = 0;
      let failed = 0;
      for (const p of todo) {
        if (cancelReq) break;
        try {
          const url = p.thumbSrc ?? picsumThumb(p.seed, 224);
          const vec = await embedImageFromUrl(url);
          await putEmbedding(p.id, vec);
        } catch (err) {
          failed += 1;
          console.warn("embed failed for", p.id, err);
        }
        done += 1;
        setProgress({ done, total: todo.length });
        setIndexed((n) => n + 1);
      }
      toast.success(
        cancelReq
          ? `أُوقف بعد فهرسة ${done - failed} صورة`
          : `اكتملت الفهرسة (${done - failed} صورة${failed ? `، فشل ${failed}` : ""})`,
      );
    } finally {
      setRunning(false);
      setCancelReq(false);
    }
  }

  async function doSearch(q?: string) {
    const text = (q ?? query).trim();
    if (!text) return;
    if (indexed === 0) {
      toast.error("ابنِ الفهرس أولاً");
      return;
    }
    setSearching(true);
    try {
      await ensureModel();
      const qvec = await embedText(text);
      const all = await allEmbeddings();
      const scored = all
        .map((e) => ({ id: e.id, score: cosine(qvec, e.vec) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 60);
      setResults(scored);
    } catch (err) {
      console.error(err);
      toast.error("فشل البحث الدلالي");
    } finally {
      setSearching(false);
    }
  }

  const rankedPhotos = useMemo(() => {
    if (!results.length) return [] as MockPhoto[];
    const byId = new Map(photos.map((p) => [p.id, p]));
    return results
      .map((r) => byId.get(r.id))
      .filter((p): p is MockPhoto => !!p);
  }, [results, photos]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">البحث الدلالي المحلي</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              يُشغّل نموذج CLIP كاملاً داخل متصفحك عبر WebAssembly. أوزان
              النموذج تُحمَّل مرة واحدة من HuggingFace وتُخزَّن في المتصفح، أما
              صورك واستعلاماتك فلا تغادر جهازك أبداً.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center md:grid-cols-4">
          <Stat label="مفهرسة" value={indexed} />
          <Stat label="متاحة" value={eligible.length} />
          <Stat
            label="النموذج"
            value={modelReady ? "جاهز" : modelLoading ? "…" : "غير محمّل"}
          />
          <Stat
            label="التقدم"
            value={
              running
                ? `${progress.done}/${progress.total}`
                : "—"
            }
          />
        </div>

        {modelProgress && (
          <p className="mt-3 truncate text-[11px] text-muted-foreground">
            {modelProgress}
          </p>
        )}
        {running && progress.total > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(progress.done / progress.total) * 100}%`,
              }}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!running ? (
            <button
              onClick={buildIndex}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              بناء / تحديث الفهرس
            </button>
          ) : (
            <button
              onClick={() => setCancelReq(true)}
              className="inline-flex items-center gap-2 rounded-full bg-destructive/90 px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
            >
              <Square className="h-4 w-4" />
              إيقاف
            </button>
          )}
          <button
            onClick={async () => {
              await clearEmbeddings();
              setIndexed(0);
              setResults([]);
              toast.success("أُفرغ الفهرس");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
            مسح الفهرس
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void doSearch();
            }}
            placeholder="صف ما تبحث عنه بكلماتك (مثال: قطة سوداء على النافذة)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => void doSearch()}
            disabled={searching || indexed === 0}
            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "ابحث"
            )}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuery(ex);
                void doSearch(ex);
              }}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {rankedPhotos.length > 0 && (
        <div>
          <p className="mb-3 px-1 text-xs text-muted-foreground">
            {rankedPhotos.length} نتيجة مرتّبة حسب التشابه الدلالي
          </p>
          <PhotoGrid
            photos={rankedPhotos}
            onOpen={onOpen}
            states={states}
            selection={new Set()}
            onToggleSelect={() => {}}
            onFavoriteToggle={() => {}}
          />
        </div>
      )}

      {!rankedPhotos.length && !searching && indexed > 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          اكتب استعلاماً أعلاه لبدء البحث الدلالي.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary/40 py-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
