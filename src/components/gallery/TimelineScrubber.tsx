import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { TimelineBucket } from "@/lib/timeline";
import { collapseToYears } from "@/lib/timeline";

interface Props {
  buckets: TimelineBucket[];
  scrollRef: RefObject<HTMLElement>;
}

/**
 * Vertical timeline scrubber (right edge on desktop). Click/drag to jump to the
 * newest photo of that month. Highlights the month currently in view.
 * Zero dependencies — pure DOM math.
 */
export function TimelineScrubber({ buckets, scrollRef }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Track which month header is closest to the scroll container's top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !buckets.length) return;
    const onScroll = () => {
      const sections = el.querySelectorAll<HTMLElement>("[data-month]");
      let best: string | null = null;
      let bestDist = Infinity;
      const anchor = el.scrollTop + 80;
      sections.forEach((s) => {
        const top = s.offsetTop;
        const dist = Math.abs(top - anchor);
        if (top <= anchor + 40 && dist < bestDist) {
          bestDist = dist;
          best = s.dataset.month ?? null;
        }
      });
      if (best) setActiveKey(best);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, buckets]);

  const jumpTo = (key: string) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-month="${key}"]`);
    if (target) el.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "smooth" });
  };

  const bucketAtY = (clientY: number): TimelineBucket | null => {
    const rail = railRef.current;
    if (!rail || !buckets.length) return null;
    const rect = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const idx = Math.min(buckets.length - 1, Math.floor(ratio * buckets.length));
    return buckets[idx];
  };

  if (buckets.length < 2) return null;
  const years = collapseToYears(buckets);

  return (
    <div
      ref={railRef}
      className="group pointer-events-auto absolute inset-y-4 left-1 z-30 hidden w-3 select-none transition-all hover:w-10 md:flex md:flex-col md:items-stretch"
      onMouseDown={(e) => {
        setDragging(true);
        const b = bucketAtY(e.clientY);
        if (b) jumpTo(b.key);
      }}
      onMouseMove={(e) => {
        const b = bucketAtY(e.clientY);
        setHoverKey(b?.key ?? null);
        if (dragging && b) jumpTo(b.key);
      }}
      onMouseLeave={() => {
        setHoverKey(null);
        setDragging(false);
      }}
      onMouseUp={() => setDragging(false)}
    >
      <div className="flex h-full flex-col justify-between rounded-full py-3 text-[10px] font-medium text-muted-foreground opacity-0 transition-all group-hover:bg-card/80 group-hover:opacity-100 group-hover:shadow-lg group-hover:backdrop-blur">
        {years.map((y) => {
          const isActive = activeKey?.startsWith(String(y.year));
          return (
            <button
              key={y.year}
              onClick={(e) => {
                e.stopPropagation();
                jumpTo(y.firstKey);
              }}
              className={cn(
                "mx-auto w-full rounded-full px-1 py-1 transition",
                isActive ? "font-bold text-primary" : "hover:text-foreground",
              )}
            >
              {y.year}
            </button>
          );
        })}
      </div>

      {hoverKey && (
        <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg">
          {buckets.find((b) => b.key === hoverKey)?.label}
        </div>
      )}
    </div>
  );
}
