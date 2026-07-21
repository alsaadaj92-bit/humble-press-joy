import { useMemo, useRef } from "react";
import { Heart, Check, Play } from "lucide-react";
import { groupByDate, picsumThumb, type MockPhoto } from "@/lib/mockPhotos";
import type { PhotoState } from "@/lib/photoDb";
import { formatDuration } from "@/lib/video";
import { monthKey } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import { densityColClasses, type GridDensity } from "@/hooks/useGridDensity";
import { EmptyState } from "./EmptyState";

const providerLabel = (p: NonNullable<MockPhoto["provider"]>) =>
  p === "telegram" ? "Telegram" : p === "localServer" ? "Local" : "FS";


interface PhotoGridProps {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
  states: Map<string, PhotoState>;
  selection: Set<string>;
  onToggleSelect: (id: string, shift: boolean) => void;
  onFavoriteToggle: (id: string) => void;
  /** Deprecated — drag-to-select removed. Kept optional for prop compatibility. */
  onSelectionChange?: (ids: string[]) => void;
  /** Currently open photo id — receives the shared view-transition name. */
  activeId?: string | null;
  /** Optional section id, used to render a domain-specific empty state. */
  section?: string;
  /** Optional current search query — shows a "no results" empty state. */
  query?: string;
  /** Tile density (columns) — persisted via useGridDensity. */
  density?: GridDensity;
}

export function PhotoGrid({
  photos,
  onOpen,
  states,
  selection,
  onToggleSelect,
  onFavoriteToggle,
  onSelectionChange: _onSelectionChange,
  activeId,
  section,
  query,
  density = "comfortable",
}: PhotoGridProps) {
  void _onSelectionChange;
  const colClasses = densityColClasses(density);
  const groups = useMemo(() => groupByDate(photos), [photos]);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [photos]);
  const selectionMode = selection.size > 0;
  const lastClickRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} dir="rtl" className="relative w-full space-y-6">

      {groups.map((group) => {
        const first = group.items[0];
        const mKey = first ? monthKey(first.date) : undefined;
        return (
        <section key={group.label} data-month={mKey}>
          <h2 className="sticky top-0 z-10 -mx-1 mb-1 bg-background/95 px-2 py-2 text-[13px] font-medium text-foreground/90 shadow-sm shadow-black/40 backdrop-blur">
            {group.label}
          </h2>
          <div className={cn("masonry gap-0.5 sm:gap-1", colClasses)}>

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
                    activeId === photo.id && "vt-active-photo",
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

      {photos.length === 0 && <EmptyState section={section} query={query} />}
    </div>
  );
}
