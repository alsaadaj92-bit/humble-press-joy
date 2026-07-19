import { useEffect, useMemo, useState } from "react";
import { Film, User, Smartphone, FileText, Star } from "lucide-react";
import { photoDb, type FaceRow, type OcrRow, type PhotoState } from "@/lib/photoDb";
import { categorize, CATEGORY_LABELS, type CategoryId } from "@/lib/categories";
import { PhotoGrid } from "./PhotoGrid";
import type { MockPhoto } from "@/lib/mockPhotos";

const ICONS: Record<CategoryId, typeof Film> = {
  videos: Film,
  selfies: User,
  screenshots: Smartphone,
  documents: FileText,
  favorites: Star,
};

interface Props {
  photos: MockPhoto[];
  states: Map<string, PhotoState>;
  onOpen: (index: number) => void;
}

export function CategoriesPanel({ photos, states, onOpen }: Props) {
  const [faces, setFaces] = useState<FaceRow[]>([]);
  const [ocr, setOcr] = useState<OcrRow[]>([]);
  const [active, setActive] = useState<CategoryId | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [f, o] = await Promise.all([
        photoDb.faces.toArray(),
        photoDb.ocr.toArray(),
      ]);
      if (!alive) return;
      setFaces(f);
      setOcr(o);
    })();
    return () => {
      alive = false;
    };
  }, [photos.length]);

  const buckets = useMemo(
    () => categorize(photos, { states, faces, ocr }),
    [photos, states, faces, ocr],
  );

  const cards: CategoryId[] = ["videos", "selfies", "screenshots", "documents", "favorites"];

  if (active) {
    const list = buckets[active];
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActive(null)}
          className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/80"
        >
          ← كل التصنيفات
        </button>
        <h2 className="text-2xl font-semibold">{CATEGORY_LABELS[active]}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد عناصر في هذا التصنيف بعد.</p>
        ) : (
          <PhotoGrid
            photos={list}
            onOpen={(i) => {
              const target = list[i];
              const globalIdx = photos.findIndex((p) => p.id === target.id);
              onOpen(globalIdx >= 0 ? globalIdx : i);
            }}
            states={states}
            selection={new Set()}
            onToggleSelect={() => {}}
            onFavoriteToggle={() => {}}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((id) => {
        const Icon = ICONS[id];
        const items = buckets[id];
        const cover = items[0];
        return (
          <button
            key={id}
            onClick={() => setActive(id)}
            className="group relative aspect-square overflow-hidden rounded-2xl bg-secondary text-right"
          >
            {cover ? (
              <img
                src={cover.thumbSrc ?? `https://picsum.photos/seed/${cover.seed}/400`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/40 to-background">
                <Icon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 text-white">
              <Icon className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">{CATEGORY_LABELS[id]}</div>
                <div className="text-[11px] opacity-80">{items.length}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
