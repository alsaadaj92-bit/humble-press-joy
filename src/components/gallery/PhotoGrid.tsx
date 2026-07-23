import { useCallback, useMemo, useRef } from "react";
import { Play } from "lucide-react";
import { groupByDate, type MockPhoto } from "@/lib/mockPhotos";
import { formatDuration } from "@/lib/video";
import { cn } from "@/lib/utils";
import { densityColClasses, type GridDensity } from "@/hooks/useGridDensity";

interface PhotoGridProps {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
  activeId?: string | null;
  density?: GridDensity;
  emptyContent?: React.ReactNode;
}

export function PhotoGrid({
  photos,
  onOpen,
  activeId,
  density = "comfortable",
  emptyContent,
}: PhotoGridProps) {
  const colClasses = densityColClasses(density);
  const groups = useMemo(() => groupByDate(photos), [photos]);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [photos]);
  const lastOpenAtRef = useRef(0);

  const handleOpen = useCallback((idx: number) => {
    const now = Date.now();
    if (now - lastOpenAtRef.current < 300) return;
    lastOpenAtRef.current = now;
    onOpen(idx);
  }, [onOpen]);

  if (photos.length === 0) {
    return <div className="w-full">{emptyContent}</div>;
  }

  return (
    <div className="relative w-full space-y-6" dir="ltr">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="sticky top-0 z-10 -mx-1 mb-1 bg-background/95 px-2 py-2 text-[13px] font-medium text-foreground/90 shadow-sm shadow-black/40 backdrop-blur" dir="rtl">
            {group.label}
          </h2>
          <div className={cn("masonry w-full gap-0.5 sm:gap-1", colClasses)}>
            {group.items.map((photo) => {
              const idx = indexOf.get(photo.id)!;
              return (
                <button
                  key={photo.id}
                  onClick={() => handleOpen(idx)}
                  className={cn(
                    "masonry-item group relative block w-full overflow-hidden rounded-lg bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeId === photo.id && "vt-active-photo",
                  )}
                  style={{
                    aspectRatio: `${photo.width || 1} / ${photo.height || 1}`,
                    viewTransitionName: activeId === photo.id ? `photo-${photo.id}` : undefined,
                  }}
                >
                  {photo.thumbSrc ? (
                    <img
                      src={photo.thumbSrc}
                      alt={photo.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:brightness-110 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-secondary text-[10px] text-muted-foreground">
                      …
                    </div>
                  )}
                  {photo.kind === "video" && (
                    <>
                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
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
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
