import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Check, Play } from "lucide-react";
import { groupByDate, picsumThumb, type MockPhoto } from "@/lib/mockPhotos";
import type { PhotoState } from "@/lib/photoDb";
import { formatDuration } from "@/lib/video";
import { monthKey } from "@/lib/timeline";
import { cn } from "@/lib/utils";

const providerLabel = (p: NonNullable<MockPhoto["provider"]>) =>
  p === "telegram" ? "Telegram" : p === "localServer" ? "Local" : "FS";


interface PhotoGridProps {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
  states: Map<string, PhotoState>;
  selection: Set<string>;
  onToggleSelect: (id: string, shift: boolean) => void;
  onFavoriteToggle: (id: string) => void;
  /** Bulk selection replacement (for drag-to-select). */
  onSelectionChange?: (ids: string[]) => void;
  /** Currently open photo id — receives the shared view-transition name. */
  activeId?: string | null;
  /** Optional section id, used to render a domain-specific empty state. */
  section?: string;
  /** Optional current search query — shows a "no results" empty state. */
  query?: string;
}

export function PhotoGrid({
  photos,
  onOpen,
  states,
  selection,
  onToggleSelect,
  onFavoriteToggle,
  onSelectionChange,
  activeId,
  section,
  query,
}: PhotoGridProps) {
  const groups = useMemo(() => groupByDate(photos), [photos]);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [photos]);
  const selectionMode = selection.size > 0;
  const lastClickRef = useRef<string | null>(null);

  // ---- Drag-to-select (desktop pointer, additive to existing selection) ----
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragBox, setDragBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; base: Set<string> } | null>(null);

  useEffect(() => {
    if (!onSelectionChange) return;
    const root = rootRef.current;
    if (!root) return;

    const onDown = (e: PointerEvent) => {
      // Only start drag on empty grid areas (not on tiles/buttons).
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, [data-tile]")) return;
      if (e.button !== 0) return;
      const rect = root.getBoundingClientRect();
      dragStartRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top + root.scrollTop,
        base: new Set(selection),
      };
      root.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const rect = root.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top + root.scrollTop;
      const x = Math.min(start.x, cx);
      const y = Math.min(start.y, cy);
      const w = Math.abs(cx - start.x);
      const h = Math.abs(cy - start.y);
      if (w < 4 && h < 4) return;
      setDragBox({ x, y, w, h });
      // Hit-test all tiles.
      const tiles = root.querySelectorAll<HTMLElement>("[data-tile]");
      const hits = new Set(start.base);
      const rootRect = root.getBoundingClientRect();
      tiles.forEach((el) => {
        const r = el.getBoundingClientRect();
        const tx = r.left - rootRect.left;
        const ty = r.top - rootRect.top + root.scrollTop;
        const overlaps = tx < x + w && tx + r.width > x && ty < y + h && ty + r.height > y;
        if (overlaps) hits.add(el.dataset.tile!);
      });
      onSelectionChange(Array.from(hits));
    };

    const onUp = () => {
      dragStartRef.current = null;
      setDragBox(null);
    };

    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onSelectionChange, selection]);

  return (
    <div ref={rootRef} className="relative space-y-6">
      {dragBox && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border-2 border-primary bg-primary/10"
          style={{ left: dragBox.x, top: dragBox.y, width: dragBox.w, height: dragBox.h }}
        />
      )}
      {groups.map((group) => {
        const first = group.items[0];
        const mKey = first ? monthKey(first.date) : undefined;
        return (
        <section key={group.label} data-month={mKey}>
          <h2 className="mb-2 px-1 text-[13px] font-medium text-foreground/80">
            {group.label}
          </h2>
          <div className="masonry gap-1 sm:gap-1.5 masonry-col-3 sm:masonry-col-4 md:masonry-col-5 lg:masonry-col-6 xl:masonry-col-7">
            {group.items.map((photo) => {
              const idx = indexOf.get(photo.id)!;
              const state = states.get(photo.id);
              const isSelected = selection.has(photo.id);
              return (
                <div
                  key={photo.id}
                  data-tile={photo.id}
                  className={cn(
                    "masonry-item group relative w-full overflow-hidden rounded-lg bg-secondary",
                    isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                >
                  <button
                    onClick={(e) => {
                      if (selectionMode || e.metaKey || e.ctrlKey || e.shiftKey) {
                        onToggleSelect(photo.id, e.shiftKey);
                        lastClickRef.current = photo.id;
                      } else {
                        onOpen(idx);
                      }
                    }}
                    className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <img
                      src={photo.thumbSrc ?? picsumThumb(photo.seed, 500)}
                      alt={photo.name}
                      loading="lazy"
                      className={cn(
                        "h-full w-full object-cover transition duration-300 group-hover:brightness-110",
                        !isSelected && "group-hover:scale-[1.02]",
                        isSelected && "scale-95",
                        !photo.thumbSrc && photo.provider && "opacity-40",
                      )}
                    />
                    {photo.provider && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        {providerLabel(photo.provider)}
                      </span>
                    )}
                    {photo.kind === "video" && (
                      <>
                        <span className="pointer-events-none absolute inset-0 grid place-items-center">
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition group-hover:scale-110">
                            <Play className="h-6 w-6 fill-current" />
                          </span>
                        </span>
                        {photo.duration ? (
                          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                            {formatDuration(photo.duration)}
                          </span>
                        ) : null}
                      </>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>


                  {/* Selection check (top-right in RTL = top-left visual) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(photo.id, e.shiftKey);
                    }}
                    aria-label="تحديد"
                    className={cn(
                      "absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full border-2 transition",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground opacity-100"
                        : "border-white/80 bg-black/30 text-transparent opacity-0 backdrop-blur group-hover:opacity-100",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>

                  {/* Favorite heart (bottom-left in RTL) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavoriteToggle(photo.id);
                    }}
                    aria-label="إضافة للمفضلة"
                    className={cn(
                      "absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full transition",
                      state?.favorite
                        ? "text-red-400 opacity-100"
                        : "text-white opacity-0 group-hover:opacity-100 hover:bg-black/40",
                    )}
                  >
                    <Heart
                      className={cn("h-5 w-5", state?.favorite && "fill-current")}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        );
      })}

      {photos.length === 0 && (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          لا توجد صور هنا بعد.
        </div>
      )}
    </div>
  );
}
