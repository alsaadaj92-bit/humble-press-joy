import { Plus, Upload, X, Camera, Calendar, MapPin, Aperture, CheckCircle2, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { extractExif, formatExposure, orientationLabel } from "@/lib/exif";
import { uploadFileToActiveProvider } from "@/lib/providers";
import { useProviders } from "@/hooks/useProviders";
import type { MediaAsset } from "@/lib/photoDb";

interface Row {
  key: string;
  name: string;
  size: number;
  previewUrl: string;
  status: "extracting" | "uploading" | "done" | "error" | "skipped";
  message?: string;
  asset?: MediaAsset;
}

export function UploadFab() {
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { active, activeConfig } = useProviders();

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) {
      toast.error("لم يتم اختيار صور");
      return;
    }

    const hasProvider = !!(active && activeConfig?.configured);

    const initial: Row[] = arr.map((f, i) => ({
      key: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      previewUrl: URL.createObjectURL(f),
      status: "extracting",
    }));
    setRows(initial);

    if (!hasProvider) {
      toast.warning("لا يوجد مزود تخزين نشط", {
        description: "الصور ستُقرأ محلياً لعرض EXIF فقط. اذهب لإعدادات المزودين لتفعيل الرفع.",
      });
    }

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      try {
        // extract EXIF (fast) so we can show something even without a provider
        const exif = await extractExif(file);
        setRows((prev) =>
          prev?.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: hasProvider ? "uploading" : "skipped",
                  asset: hasProvider
                    ? r.asset
                    : ({
                        id: r.key,
                        provider: "telegram",
                        name: file.name,
                        size: file.size,
                        mime: file.type,
                        date: exif.dateTaken ?? file.lastModified,
                        createdAt: Date.now(),
                        exif,
                      } as MediaAsset),
                }
              : r,
          ) ?? null,
        );

        if (hasProvider) {
          const asset = await uploadFileToActiveProvider(file);
          setRows((prev) =>
            prev?.map((r, idx) =>
              idx === i ? { ...r, status: "done", asset } : r,
            ) ?? null,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRows((prev) =>
          prev?.map((r, idx) =>
            idx === i ? { ...r, status: "error", message } : r,
          ) ?? null,
        );
      }
    }

    if (hasProvider) {
      toast.success("انتهى الرفع", {
        description: `تم رفع ${arr.length} ملف عبر ${active}.`,
      });
    }
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
          <p className="font-semibold">أفلت الصور هنا للرفع</p>
        </div>
      </div>

      <div
        className="fixed inset-0 z-20"
        onDragEnter={() => setDragging(true)}
        style={{ pointerEvents: "none" }}
      />

      <button
        onClick={openPicker}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
        style={{ boxShadow: "var(--shadow-fab)" }}
      >
        <Plus className="h-5 w-5" />
        <span>{active ? `رفع عبر ${labelOf(active)}` : "استيراد صور"}</span>
      </button>

      {rows && <ImportModal rows={rows} onClose={() => setRows(null)} />}
    </>
  );
}

function labelOf(k: string) {
  if (k === "telegram") return "تيليجرام";
  if (k === "localServer") return "الخادم المحلي";
  return k;
}

function ImportModal({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
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
            <h3 className="text-base font-semibold">استيراد الصور</h3>
            <p className="text-xs text-muted-foreground">
              {rows.length} ملف · EXIF يُستخرج محلياً في المتصفح
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

        <div className="scrollbar-thin max-h-[70vh] divide-y divide-border overflow-y-auto">
          {rows.map((r) => (
            <RowItem key={r.key} row={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowItem({ row }: { row: Row }) {
  const { asset } = row;
  const exif = asset?.exif;
  const dateLabel = exif?.dateTaken
    ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeStyle: "short" }).format(
        exif.dateTaken,
      )
    : "—";
  const settings = exif
    ? [
        exif.fNumber && `f/${exif.fNumber}`,
        formatExposure(exif.exposureTime),
        exif.iso && `ISO ${exif.iso}`,
        exif.focalLength && `${exif.focalLength}mm`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="flex gap-4 p-4">
      <img
        src={row.previewUrl}
        alt={row.name}
        className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          <StatusBadge status={row.status} message={row.message} />
        </div>
        <Field icon={<Calendar className="h-3.5 w-3.5" />} label="التاريخ" value={dateLabel} />
        <Field
          icon={<Camera className="h-3.5 w-3.5" />}
          label="الكاميرا"
          value={exif?.camera ?? "—"}
        />
        <Field
          icon={<Aperture className="h-3.5 w-3.5" />}
          label="العدسة"
          value={exif?.lens ?? "—"}
        />
        {settings && <Field label="الإعدادات" value={settings} />}
        {exif?.orientation && (
          <Field label="الاتجاه" value={orientationLabel(exif.orientation) ?? "-"} />
        )}
        {exif?.gps && (
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

function StatusBadge({ status, message }: { status: Row["status"]; message?: string }) {
  const map: Record<Row["status"], { label: string; className: string; icon?: React.ReactNode }> = {
    extracting: { label: "قراءة EXIF...", className: "bg-secondary text-muted-foreground" },
    uploading: { label: "جارٍ الرفع...", className: "bg-primary/15 text-primary" },
    done: {
      label: "تم الرفع",
      className: "bg-emerald-500/15 text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    skipped: {
      label: "EXIF فقط",
      className: "bg-secondary text-muted-foreground",
    },
    error: {
      label: message ?? "خطأ",
      className: "bg-destructive/15 text-destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        s.className,
      )}
      title={message}
    >
      {s.icon}
      {s.label}
    </span>
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
      <span className="flex min-w-[72px] items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
