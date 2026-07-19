import { useMemo } from "react";
import { groupByDate, picsumThumb, type MockPhoto } from "@/lib/mockPhotos";

interface PhotoGridProps {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
}

export function PhotoGrid({ photos, onOpen }: PhotoGridProps) {
  const groups = useMemo(() => groupByDate(photos), [photos]);

  // We need to map each photo back to its absolute index in `photos`
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [photos]);

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
              return (
                <button
                  key={photo.id}
                  onClick={() => onOpen(idx)}
                  className="masonry-item group relative w-full overflow-hidden rounded-lg bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                >
                  <img
                    src={picsumThumb(photo.seed, 500)}
                    alt={photo.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] group-hover:brightness-110"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
