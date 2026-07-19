import { useMemo, useRef } from "react";
import { Heart, Check } from "lucide-react";
import { groupByDate, picsumThumb, type MockPhoto } from "@/lib/mockPhotos";
import type { PhotoState } from "@/lib/photoDb";
import { cn } from "@/lib/utils";

interface PhotoGridProps {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
  states: Map<string, PhotoState>;
  selection: Set<string>;
  onToggleSelect: (id: string, shift: boolean) => void;
  onFavoriteToggle: (id: string) => void;
}

export function PhotoGrid({
  photos,
  onOpen,
  states,
  selection,
  onToggleSelect,
  onFavoriteToggle,
}: PhotoGridProps) {
  const groups = useMemo(() => groupByDate(photos), [photos]);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [photos]);
  const selectionMode = selection.size > 0;
  const lastClickRef = useRef<string | null>(null);

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 text-sm font-semibold text-foreground/90">
            {group.label}
          </h2>
          <div className="masonry masonry-col-2 sm:masonry-col-3 lg:masonry-col-4 xl:masonry-col-5">
            {group.items.map((photo) => {
              const idx = indexOf.get(photo.id)!;
              const state = states.get(photo.id);
              const isSelected = selection.has(photo.id);
              return (
                <div
                  key={photo.id}
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
                      src={picsumThumb(photo.seed, 500)}
                      alt={photo.name}
                      loading="lazy"
                      className={cn(
                        "h-full w-full object-cover transition duration-300 group-hover:brightness-110",
                        !isSelected && "group-hover:scale-[1.02]",
                        isSelected && "scale-95",
                      )}
                    />
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
      ))}

      {photos.length === 0 && (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          لا توجد صور هنا بعد.
        </div>
      )}
    </div>
  );
}
