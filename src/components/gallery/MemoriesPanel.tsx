import { useMemo, useState } from "react";
import { Sparkles, X, ChevronRight, ChevronLeft } from "lucide-react";
import { buildMemories, type MemoryStory } from "@/lib/memories";
import type { MockPhoto } from "@/lib/mockPhotos";
import { picsumThumb, picsumUrl } from "@/lib/mockPhotos";

function coverSrc(p: MockPhoto, w = 800, h = 800) {
  return p.thumbSrc || p.fullSrc || picsumUrl(p.seed, w, h);
}
function thumbSrc(p: MockPhoto) {
  return p.thumbSrc || picsumThumb(p.seed, 400);
}
function fullSrc(p: MockPhoto) {
  return p.fullSrc || p.thumbSrc || picsumUrl(p.seed, 1200, 900);
}

export function MemoriesPanel({ photos }: { photos: MockPhoto[] }) {
  const stories = useMemo(() => buildMemories(photos), [photos]);
  const [openId, setOpenId] = useState<string | null>(null);
  const openStory = stories.find((s) => s.id === openId) ?? null;

  if (!stories.length) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">لا توجد ذكريات بعد</h2>
        <p className="text-sm text-muted-foreground">
          كل ما ترفعه سيظهر هنا لاحقاً كذكريات: «في مثل هذا اليوم»، ملخّصات السنوات، ولحظات الأسبوع.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Horizontal story rail */}
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">ذكرياتك</h2>
      </div>

      <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpenId(s.id)}
            className="group relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl border border-border ring-primary/40 transition hover:ring-2 md:w-48"
          >
            <img
              src={coverSrc(s.cover, 400, 700)}
              alt={s.title}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-right text-white">
              <p className="text-sm font-semibold leading-tight">{s.title}</p>
              <p className="mt-0.5 text-[11px] text-white/80">{s.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Grid of story details */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} onOpen={() => setOpenId(s.id)} />
        ))}
      </div>

      {openStory && <StoryViewer story={openStory} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StoryCard({ story, onOpen }: { story: MemoryStory; onOpen: () => void }) {
  const preview = story.photos.slice(0, 4);
  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 text-right transition hover:border-primary/40 hover:bg-card"
    >
      <div className="grid h-20 w-20 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {preview.map((p) => (
          <img key={p.id} src={thumbSrc(p)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{story.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{story.subtitle}</p>
      </div>
    </button>
  );
}

function StoryViewer({ story, onClose }: { story: MemoryStory; onClose: () => void }) {
  const [i, setI] = useState(0);
  const p = story.photos[i];
  const prev = () => setI((v) => (v - 1 + story.photos.length) % story.photos.length);
  const next = () => setI((v) => (v + 1) % story.photos.length);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">{story.title}</p>
          <p className="text-[11px] text-white/70">
            {i + 1} / {story.photos.length} · {story.subtitle}
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* progress bars */}
      <div className="flex gap-1 px-4" onClick={(e) => e.stopPropagation()}>
        {story.photos.map((_, idx) => (
          <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded bg-white/20">
            <div
              className="h-full bg-white transition-all"
              style={{ width: idx < i ? "100%" : idx === i ? "50%" : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={prev}
          className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="السابقة"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <img
          src={fullSrc(p)}
          alt={p.name}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        <button
          onClick={next}
          className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="التالية"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
