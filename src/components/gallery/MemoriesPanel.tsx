import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X, ChevronRight, ChevronLeft } from "lucide-react";
import { buildMemories, type MemoryStory } from "@/lib/memories";
import type { MockPhoto } from "@/lib/mockPhotos";
import { picsumThumb, picsumUrl } from "@/lib/mockPhotos";
import { cn } from "@/lib/utils";

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
  const [featured, setFeatured] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const openStory = stories.find((s) => s.id === openId) ?? null;

  // Auto-rotate the featured story every 5s (Google Photos-style hero rail).
  useEffect(() => {
    if (!stories.length || openId) return;
    const t = window.setInterval(() => {
      setFeatured((v) => (v + 1) % stories.length);
    }, 5000);
    return () => window.clearInterval(t);
  }, [stories.length, openId]);

  // Scroll the rail so the featured card is in view.
  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-story-idx="${featured}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [featured]);

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

      <div ref={railRef} className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        {stories.map((s, idx) => (
          <button
            key={s.id}
            data-story-idx={idx}
            onClick={() => setOpenId(s.id)}
            className={cn(
              "group relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl border transition md:w-48",
              idx === featured
                ? "border-primary ring-2 ring-primary/60 scale-[1.03]"
                : "border-border hover:ring-2 hover:ring-primary/40",
            )}
          >
            <img
              src={coverSrc(s.cover, 400, 700)}
              alt={s.title}
              className={cn(
                "h-full w-full object-cover transition-transform duration-700",
                idx === featured ? "scale-110" : "group-hover:scale-105",
              )}
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

      {/* Progress dots */}
      {stories.length > 1 && (
        <div className="mt-1 flex justify-center gap-1">
          {stories.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setFeatured(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === featured ? "w-6 bg-primary" : "w-1.5 bg-muted",
              )}
              aria-label={`ذكرى ${idx + 1}`}
            />
          ))}
        </div>
      )}

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
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const DURATION = 4500;

  const prev = () => { setProgress(0); setI((v) => (v - 1 + story.photos.length) % story.photos.length); };
  const next = () => { setProgress(0); setI((v) => (v + 1) % story.photos.length); };

  // Auto-advance timer, updates the progress bar 30x/s.
  useEffect(() => {
    if (paused) return;
    const start = Date.now() - (progress / 100) * DURATION;
    const t = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(t);
        next();
      }
    }, 33);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
      else if (e.key === " ") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    setDragX(e.touches[0].clientX - startX.current);
  };
  const onTouchEnd = () => {
    setPaused(false);
    const dx = dragX;
    setDragX(0);
    startX.current = null;
    if (Math.abs(dx) > 60) { dx > 0 ? prev() : next(); }
  };

  const p = story.photos[i];
  const prevP = story.photos[(i - 1 + story.photos.length) % story.photos.length];
  const nextP = story.photos[(i + 1) % story.photos.length];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white safe-top"
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
              className="h-full bg-white"
              style={{
                width: idx < i ? "100%" : idx === i ? `${progress}%` : "0%",
                transition: idx === i ? "width 60ms linear" : "none",
              }}
            />
          </div>
        ))}
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
      >
        {/* Sliding track */}
        <div
          className="absolute inset-0 flex"
          style={{
            transform: `translateX(calc(${dragX}px))`,
            transition: startX.current == null ? "transform 300ms cubic-bezier(.22,1,.36,1)" : "none",
          }}
        >
          <div className="flex h-full w-full shrink-0 items-center justify-center" style={{ transform: "translateX(-100%)" }}>
            <img src={fullSrc(prevP)} alt="" className="max-h-full max-w-full rounded-2xl object-contain opacity-90" />
          </div>
          <div className="flex h-full w-full shrink-0 items-center justify-center">
            <img
              key={p.id}
              src={fullSrc(p)}
              alt={p.name}
              className="max-h-full max-w-full rounded-2xl object-contain animate-in fade-in zoom-in-95 duration-500"
              style={{ animationFillMode: "both" }}
            />
          </div>
          <div className="flex h-full w-full shrink-0 items-center justify-center" style={{ transform: "translateX(100%)" }}>
            <img src={fullSrc(nextP)} alt="" className="max-h-full max-w-full rounded-2xl object-contain opacity-90" />
          </div>
        </div>

        {/* Tap zones (mobile-style: right = back for RTL, left = forward) */}
        <button
          className="absolute inset-y-0 right-0 w-1/3"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="السابقة"
        />
        <button
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="التالية"
        />

        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid"
          aria-label="السابقة"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 md:grid"
          aria-label="التالية"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
