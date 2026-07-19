import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Pencil, X, ZoomIn, ZoomOut } from "lucide-react";
import { picsumUrl, type MockPhoto } from "@/lib/mockPhotos";
import { cn } from "@/lib/utils";
import { photoDb } from "@/lib/photoDb";
import { formatExposure, orientationLabel, type ExifData } from "@/lib/exif";
import { MiniMap } from "./MiniMap";
import { PhotoEditor } from "./PhotoEditor";

interface LightboxProps {
  photos: MockPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export function Lightbox({ photos, index, onClose, onIndexChange }: LightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exif, setExif] = useState<ExifData | null>(null);

  const open = index !== null;
  const photo = open ? photos[index!] : null;

  useEffect(() => {
    if (!photo) {
      setExif(null);
      return;
    }
    let cancelled = false;
    photoDb.states.get(photo.id).then((s) => {
      if (!cancelled) setExif(s?.exif ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const goPrev = useCallback(() => {
    if (index === null) return;
    onIndexChange((index - 1 + photos.length) % photos.length);
    setZoomed(false);
  }, [index, photos.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onIndexChange((index + 1) % photos.length);
    setZoomed(false);
  }, [index, photos.length, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // In RTL, ArrowRight = previous, ArrowLeft = next
      if (e.key === "ArrowRight") goPrev();
      if (e.key === "ArrowLeft") goNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  // Basic swipe support
  useEffect(() => {
    if (!open) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 50) return;
      // RTL: swipe right => previous
      if (dx > 0) goPrev();
      else goNext();
    };
    document.addEventListener("touchstart", onTouchStart);
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, goPrev, goNext]);

  if (!open || !photo) return null;

  const fullSrc =
    photo.fullSrc ??
    picsumUrl(photo.seed, 1400, Math.round((1400 * photo.height) / photo.width));
  const dateLabel = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "full",
  }).format(photo.date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--overlay))]/95 backdrop-blur-sm"
      style={{ boxShadow: "var(--shadow-lightbox)" }}
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-4">
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomed((z) => !z)}
            className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label={zoomed ? "تصغير" : "تكبير"}
          >
            {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setShowInfo((s) => !s)}
            className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label="التفاصيل"
          >
            <Info className="h-5 w-5" />
          </button>
          {photo.kind !== "video" && (
            <button
              onClick={() => setEditing(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
              aria-label="تحرير"
            >
              <Pencil className="h-5 w-5" />
            </button>
          )}
          <a
            href={fullSrc}
            download={photo.name}
            className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label="تحميل"
          >
            <Download className="h-5 w-5" />
          </a>
        </div>
      </div>

      {editing && (
        <PhotoEditor
          src={fullSrc}
          fileName={photo.name}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Prev / Next (mirrored for RTL: chevron-right = previous) */}
      <button
        onClick={goPrev}
        className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 md:block"
        aria-label="السابق"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
      <button
        onClick={goNext}
        className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 md:block"
        aria-label="التالي"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Media */}
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-auto p-4 md:p-10",
          zoomed && photo.kind !== "video" && "cursor-zoom-out",
          !zoomed && photo.kind !== "video" && "cursor-zoom-in",
        )}
        onClick={(e) => {
          if (photo.kind === "video") return;
          if (e.target === e.currentTarget) setZoomed((z) => !z);
        }}
      >
        {photo.kind === "video" && photo.fullSrc ? (
          <video
            key={photo.id}
            src={photo.fullSrc}
            poster={photo.thumbSrc}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={fullSrc}
            alt={photo.name}
            onClick={() => setZoomed((z) => !z)}
            className={cn(
              "select-none rounded-lg shadow-2xl transition duration-300",
              zoomed
                ? "max-h-none max-w-none scale-[1.6]"
                : "max-h-full max-w-full object-contain",
            )}
          />
        )}
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="scrollbar-thin absolute inset-y-0 left-0 z-10 w-80 overflow-y-auto border-l border-border bg-card/95 p-5 text-sm backdrop-blur">
          <h3 className="mb-3 text-base font-semibold">تفاصيل الصورة</h3>
          <dl className="space-y-2.5 text-muted-foreground">
            <InfoField label="الاسم" value={photo.name} />
            <InfoField
              label="التاريخ"
              value={
                exif?.dateTaken
                  ? new Intl.DateTimeFormat("ar-EG", {
                      dateStyle: "full",
                      timeStyle: "short",
                    }).format(exif.dateTaken)
                  : dateLabel
              }
            />
            <InfoField
              label="الأبعاد"
              value={`${exif?.width ?? photo.width} × ${exif?.height ?? photo.height}`}
            />

            {exif ? (
              <>
                <div className="!mt-4 border-t border-border pt-3 text-xs uppercase tracking-wider text-muted-foreground/70">
                  EXIF (مستخرج محلياً)
                </div>
                <InfoField label="الكاميرا" value={exif.camera ?? "—"} />
                <InfoField label="العدسة" value={exif.lens ?? "—"} />
                <InfoField
                  label="الاتجاه"
                  value={orientationLabel(exif.orientation) ?? "—"}
                />
                {(exif.fNumber || exif.exposureTime || exif.iso || exif.focalLength) && (
                  <InfoField
                    label="الإعدادات"
                    value={[
                      exif.fNumber && `f/${exif.fNumber}`,
                      formatExposure(exif.exposureTime),
                      exif.iso && `ISO ${exif.iso}`,
                      exif.focalLength && `${exif.focalLength}mm`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                )}
                {exif.gps && (
                  <>
                    <InfoField
                      label="الموقع"
                      value={`${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)}`}
                    />
                    <div className="!mt-2">
                      <MiniMap lat={exif.gps.lat} lon={exif.gps.lon} />
                    </div>
                  </>
                )}
              </>
            ) : (
              <InfoField label="المصدر" value="Picsum (بدون EXIF)" />
            )}
          </dl>
        </div>
      )}

      {/* Footer counter */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80">
        {index! + 1} / {photos.length}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
