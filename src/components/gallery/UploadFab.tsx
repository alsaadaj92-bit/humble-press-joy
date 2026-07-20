import { Plus, Upload, X, Camera as CameraIcon, Calendar, MapPin, Aperture, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { extractExif, formatExposure, orientationLabel } from "@/lib/exif";
import { extractVideoMeta, formatDuration, isVideoMime } from "@/lib/video";
import { useProviders } from "@/hooks/useProviders";
import { enqueueFiles, getSyncSettings } from "@/lib/syncEngine";
import type { MediaAsset } from "@/lib/photoDb";
import { isNative, pickFromGallery, takePhoto, tap } from "@/lib/native";

interface Row {
  key: string;
  name: string;
  size: number;
  previewUrl: string;
  status: "extracting" | "queued" | "skipped" | "error";
  message?: string;
  asset?: MediaAsset;
}

export function UploadFab() {
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const { active, activeConfig } = useProviders();

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (!arr.length) {
      toast.error("لم يتم اختيار صور أو مقاطع");
      return;
    }

    const hasProvider = !!(active && activeConfig?.configured);
    const { photoDb } = await import("@/lib/photoDb");

    // Insert every imported file straight into the gallery (works with or
    // without a sync provider). The blob is stored locally in IndexedDB so it
    // survives reloads and shows up in the grid immediately.
    const insertAsset = async (file: File) => {
      const id = `local-${file.size}-${file.lastModified}-${file.name}`;
      const existing = await photoDb.assets.get(id);
      if (existing) return;
      const isVideo = isVideoMime(file.type);
      let width: number | undefined;
      let height: number | undefined;
      let dateTaken = file.lastModified || Date.now();
      let posterDataUrl: string | undefined;
      let duration: number | undefined;
      try {
        if (isVideo) {
          const meta = await extractVideoMeta(file);
          width = meta.width;
          height = meta.height;
          duration = meta.duration;
          posterDataUrl = meta.posterDataUrl;
        } else {
          const exif = await extractExif(file);
          width = exif.width;
          height = exif.height;
          if (exif.dateTaken) dateTaken = exif.dateTaken;
        }
      } catch { /* ignore metadata failures */ }
      await photoDb.assets.put({
        id,
        provider: active ?? "device",
        name: file.name,
        size: file.size,
        mime: file.type || (isVideo ? "video/*" : "image/*"),
        width,
        height,
        date: dateTaken,
        createdAt: Date.now(),
        kind: isVideo ? "video" : "image",
        blob: file,
        posterDataUrl,
        duration,
      });
    };

    // Large batches: skip the per-file preview modal to avoid freezing.
    const LARGE_BATCH = 200;
    if (arr.length > LARGE_BATCH) {
      toast.info(`جارٍ استيراد ${arr.length.toLocaleString("ar-EG")} ملف...`);
      const CHUNK = 100;
      for (let i = 0; i < arr.length; i += CHUNK) {
        await Promise.all(arr.slice(i, i + CHUNK).map(insertAsset));
      }
      if (hasProvider) {
        for (let i = 0; i < arr.length; i += 500) {
          await enqueueFiles(arr.slice(i, i + 500));
        }
        toast.success(`أُضيفت ${arr.length.toLocaleString("ar-EG")} صورة للمعرض والطابور`);
      } else {
        toast.success(`أُضيفت ${arr.length.toLocaleString("ar-EG")} صورة للمعرض`, {
          description: "فعّل مزود تخزين لبدء الرفع/المزامنة.",
        });
      }
      return;
    }

    const initial: Row[] = arr.map((f, i) => ({
      key: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      previewUrl: URL.createObjectURL(f),
      status: "extracting",
    }));
    setRows(initial);

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const isVideo = isVideoMime(file.type);
      try {
        await insertAsset(file);
        let asset: MediaAsset;
        if (isVideo) {
          const meta = await extractVideoMeta(file);
          asset = {
            id: initial[i].key,
            provider: active ?? "device",
            name: file.name,
            size: file.size,
            mime: file.type,
            width: meta.width,
            height: meta.height,
            date: file.lastModified,
            createdAt: Date.now(),
            kind: "video",
            duration: meta.duration,
            posterDataUrl: meta.posterDataUrl,
          };
        } else {
          const exif = await extractExif(file);
          asset = {
            id: initial[i].key,
            provider: active ?? "device",
            name: file.name,
            size: file.size,
            mime: file.type,
            date: exif.dateTaken ?? file.lastModified,
            createdAt: Date.now(),
            exif,
            kind: "image",
          };
        }
        setRows((prev) =>
          prev?.map((r, idx) =>
            idx === i
              ? { ...r, status: hasProvider ? "queued" : "skipped", asset }
              : r,
          ) ?? null,
        );
      } catch (err) {
        setRows((prev) =>
          prev?.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", message: err instanceof Error ? err.message : String(err) }
              : r,
          ) ?? null,
        );
      }
    }

    if (hasProvider) {
      await enqueueFiles(arr);
      const settings = await getSyncSettings();
      const desc =
        settings.mode === "manual"
          ? "الوضع يدوي — افتح مركز المزامنة وشغّل الآن."
          : settings.paused
          ? "المزامنة موقوفة مؤقتاً — استأنفها من مركز المزامنة."
          : `سيبدأ الرفع تلقائياً عبر ${labelOf(active!)}.`;
      toast.success(`أُضيفت ${arr.length} صورة للمعرض والطابور`, { description: desc });
    } else {
      toast.success(`أُضيفت ${arr.length} صورة للمعرض`, {
        description: "فعّل مزود تخزين لبدء الرفع/المزامنة.",
      });
    }
  };

  const openPicker = () => inputRef.current?.click();

  const [menuOpen, setMenuOpen] = useState(false);

  const nativeCamera = async () => {
    setMenuOpen(false);
    await tap("light");
    try {
      const f = await takePhoto();
      if (f) await handleFiles([f]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };
  const nativeGallery = async () => {
    setMenuOpen(false);
    await tap("light");
    try {
      const files = await pickFromGallery(0); // 0 = بلا حد
      if (files.length) await handleFiles(files);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };
  const openFolder = () => {
    setMenuOpen(false);
    folderRef.current?.click();
  };




  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error non-standard attrs for folder picking
        webkitdirectory=""
        directory=""
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

      <div className="fixed bottom-24 left-4 z-40 flex flex-col items-start gap-2 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {menuOpen && (
          <>
            {isNative() && (
              <>
                <button
                  onClick={nativeCamera}
                  className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-lg"
                >
                  <CameraIcon className="h-4 w-4" /> كاميرا
                </button>
                <button
                  onClick={nativeGallery}
                  className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-lg"
                >
                  <ImageIcon className="h-4 w-4" /> كل صور المعرض (بلا حد)
                </button>
              </>
            )}
            <button
              onClick={() => { setMenuOpen(false); openPicker(); }}
              className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-lg"
            >
              <Upload className="h-4 w-4" /> اختيار ملفات (متعدد)
            </button>
            <button
              onClick={openFolder}
              className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-lg"
            >
              <Upload className="h-4 w-4" /> استيراد مجلد كامل
            </button>
          </>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
          style={{ boxShadow: "var(--shadow-fab)" }}
        >
          <Plus className="h-5 w-5" />
          <span>{active ? `رفع عبر ${labelOf(active)}` : "استيراد صور"}</span>
        </button>
      </div>

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
  const isVideo = asset?.kind === "video";
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
      <div className="relative h-24 w-24 flex-shrink-0">
        <img
          src={asset?.posterDataUrl ?? row.previewUrl}
          alt={row.name}
          className="h-24 w-24 rounded-lg object-cover"
        />
        {isVideo && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            ▶ {asset?.duration ? formatDuration(asset.duration) : "…"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          <StatusBadge status={row.status} message={row.message} />
        </div>
        {isVideo ? (
          <>
            <Field label="النوع" value="فيديو" />
            <Field
              label="الأبعاد"
              value={
                asset?.width && asset?.height
                  ? `${asset.width} × ${asset.height}`
                  : "—"
              }
            />
            <Field
              label="المدة"
              value={asset?.duration ? formatDuration(asset.duration) : "—"}
            />
          </>
        ) : (
          <>
            <Field icon={<Calendar className="h-3.5 w-3.5" />} label="التاريخ" value={dateLabel} />
            <Field
              icon={<CameraIcon className="h-3.5 w-3.5" />}
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
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, message }: { status: Row["status"]; message?: string }) {
  const map: Record<Row["status"], { label: string; className: string; icon?: React.ReactNode }> = {
    extracting: { label: "قراءة EXIF...", className: "bg-secondary text-muted-foreground" },
    queued: {
      label: "في طابور المزامنة",
      className: "bg-primary/15 text-primary",
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
