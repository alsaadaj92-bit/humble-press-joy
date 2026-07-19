import { Plus, Upload, X, Camera, Calendar, MapPin, Aperture } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { extractExif, formatExposure, orientationLabel, type ExifData } from "@/lib/exif";
import { localPhotoId, photoDb } from "@/lib/photoDb";

interface ImportedItem {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
  exif: ExifData;
}

export function UploadFab() {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<ImportedItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) {
      toast({ title: "لم يتم اختيار صور", description: "الملفات المدعومة: صور فقط في هذه الخطوة." });
      return;
    }
    const results: ImportedItem[] = [];
    for (const file of arr) {
      const exif = await extractExif(file);
      const id = localPhotoId(file);
      await photoDb.states.put({
        id,
        sourceName: file.name,
        importedAt: Date.now(),
        exif,
      });
      results.push({
        id,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        exif,
      });
    }
    setItems(results);
    toast({
      title: `تم استخراج EXIF من ${results.length} صورة`,
      description: "البيانات محفوظة محلياً في IndexedDB — لم تُرفع لأي خادم.",
    });
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drag overlay */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-primary/70 bg-primary/10 backdrop-blur-sm transition-opacity",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="rounded-2xl bg-card px-6 py-4 text-center shadow-2xl">
          <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-semibold">أفلت الصور هنا لاستخراج EXIF</p>
        </div>
      </div>

      <div
        className="fixed inset-0 z-20"
        onDragEnter={() => setDragging(true)}
        style={{ pointerEvents: "none" }}
      />

      {/* FAB */}
      <button
        onClick={openPicker}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
        style={{ boxShadow: "var(--shadow-fab)" }}
      >
        <Plus className="h-5 w-5" />
        <span>استيراد صور</span>
      </button>

      {items && <ImportResultsModal items={items} onClose={() => setItems(null)} />}
    </>
  );
}

function ImportResultsModal({ items, onClose }: { items: ImportedItem[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-base font-semibold">بيانات EXIF المستخرجة محلياً</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} صورة · لم تُرسل لأي خادم
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto divide-y divide-border">
          {items.map((it) => (
            <ExifRow key={it.id} item={it} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExifRow({ item }: { item: ImportedItem }) {
  const { exif } = item;
  const dateLabel = exif.dateTaken
    ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeStyle: "short" }).format(
        exif.dateTaken,
      )
    : "غير متوفر";

  const settings = [
    exif.fNumber && `f/${exif.fNumber}`,
    formatExposure(exif.exposureTime),
    exif.iso && `ISO ${exif.iso}`,
    exif.focalLength && `${exif.focalLength}mm`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex gap-4 p-4">
      <img
        src={item.previewUrl}
        alt={item.name}
        className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="truncate font-medium">{item.name}</div>
        <Field icon={<Calendar className="h-3.5 w-3.5" />} label="التاريخ" value={dateLabel} />
        <Field
          icon={<Camera className="h-3.5 w-3.5" />}
          label="الكاميرا"
          value={exif.camera ?? "غير متوفر"}
        />
        <Field
          icon={<Aperture className="h-3.5 w-3.5" />}
          label="العدسة"
          value={exif.lens ?? "غير متوفر"}
        />
        {settings && <Field label="الإعدادات" value={settings} />}
        {exif.orientation && (
          <Field label="الاتجاه" value={orientationLabel(exif.orientation) ?? "-"} />
        )}
        {exif.width && exif.height && (
          <Field label="الأبعاد" value={`${exif.width} × ${exif.height}`} />
        )}
        {exif.gps && (
          <Field
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="الموقع"
            value={`${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)}`}
          />
        )}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground min-w-[72px]">
        {icon}
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
