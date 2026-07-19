import { useEffect, useRef, useState } from "react";
import { Camera, Upload, ScanLine, FileText, Download, X, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  detectDocumentQuad,
  defaultQuad,
  loadImageFromBlob,
  warpDocument,
  canvasToBlob,
  scansToPdf,
  type Quad,
  type Point,
  type ScanMode,
} from "@/lib/documentScanner";

interface Page {
  id: string;
  img: HTMLImageElement;
  quad: Quad;
  mode: ScanMode;
  preview: string;
}

const MODES: { id: ScanMode; label: string }[] = [
  { id: "color", label: "ملوّن" },
  { id: "grayscale", label: "رمادي" },
  { id: "bw", label: "أبيض/أسود" },
];

async function fileToPage(file: Blob): Promise<Page> {
  const img = await loadImageFromBlob(file);
  let quad: Quad;
  try { quad = detectDocumentQuad(img); } catch { quad = defaultQuad(img); }
  const cnv = warpDocument(img, quad, { mode: "grayscale" });
  return {
    id: crypto.randomUUID(),
    img,
    quad,
    mode: "grayscale",
    preview: cnv.toDataURL("image/jpeg", 0.85),
  };
}

export function DocumentScannerPanel() {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next: Page[] = [];
      for (const f of Array.from(files)) {
        try { next.push(await fileToPage(f)); }
        catch (e) { toast.error(`تعذّر معالجة ${f.name}`); }
      }
      setPages((p) => [...p, ...next]);
      if (next.length) toast.success(`تمّ اكتشاف ${next.length} صفحة محلياً`);
    } finally { setBusy(false); }
  };

  const rebuild = async (page: Page): Promise<Page> => {
    const cnv = warpDocument(page.img, page.quad, { mode: page.mode });
    return { ...page, preview: cnv.toDataURL("image/jpeg", 0.85) };
  };

  const updatePage = async (updated: Page) => {
    const rebuilt = await rebuild(updated);
    setPages((prev) => prev.map((p) => (p.id === rebuilt.id ? rebuilt : p)));
    setEditing(rebuilt);
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (editing?.id === id) setEditing(null);
  };

  const downloadPage = async (page: Page) => {
    const cnv = warpDocument(page.img, page.quad, { mode: page.mode });
    const blob = await canvasToBlob(cnv, "image/jpeg", 0.9);
    triggerDownload(blob, `scan-${Date.now()}.jpg`);
  };

  const downloadPdf = async () => {
    if (!pages.length) return toast.error("لا توجد صفحات");
    setBusy(true);
    try {
      const canvases = pages.map((p) => warpDocument(p.img, p.quad, { mode: p.mode }));
      const blob = await scansToPdf(canvases);
      triggerDownload(blob, `scan-${Date.now()}.pdf`);
      toast.success("تم إنشاء PDF محلياً");
    } catch (e) {
      toast.error("فشل إنشاء PDF");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => camRef.current?.click()}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Camera className="h-4 w-4" /> التقاط بالكاميرا
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
          >
            <Upload className="h-4 w-4" /> رفع من الجهاز
          </button>
          <button
            onClick={downloadPdf}
            disabled={!pages.length || busy}
            className="mr-auto flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            تصدير PDF ({pages.length})
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          كل المعالجة تحدث داخل متصفحك — لا يُرفع أي شيء. اقتصاص، تصحيح المنظور، وتحسين النص كلها محلية.
        </p>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden multiple
          onChange={(e) => addFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*" hidden multiple
          onChange={(e) => addFiles(e.target.files)} />
      </div>

      {!pages.length && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <ScanLine className="mx-auto mb-3 h-10 w-10 opacity-60" />
          لا توجد مسحوبات بعد. التقط ورقة أو إيصالاً بالكاميرا للبدء.
        </div>
      )}

      {pages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p, idx) => (
            <div key={p.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={p.preview} alt={`صفحة ${idx + 1}`} className="w-full" />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="text-xs text-muted-foreground">صفحة {idx + 1} · {p.mode}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(p)} title="تعديل" className="rounded-full bg-secondary p-1.5 hover:bg-accent">
                    <Wand2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => downloadPage(p)} title="تنزيل JPG" className="rounded-full bg-secondary p-1.5 hover:bg-accent">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => removePage(p.id)} title="حذف" className="rounded-full bg-destructive/20 p-1.5 text-destructive hover:bg-destructive/30">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <QuadEditor
          page={editing}
          onCancel={() => setEditing(null)}
          onSave={(quad, mode) => updatePage({ ...editing, quad, mode })}
        />
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Quad Editor ----
interface QuadEditorProps {
  page: Page;
  onCancel: () => void;
  onSave: (quad: Quad, mode: ScanMode) => void;
}

function QuadEditor({ page, onCancel, onSave }: QuadEditorProps) {
  const [quad, setQuad] = useState<Quad>(page.quad);
  const [mode, setMode] = useState<ScanMode>(page.mode);
  const [dragKey, setDragKey] = useState<keyof Quad | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ w: 1, h: 1 });

  useEffect(() => {
    const el = wrapRef.current?.querySelector("img");
    if (!el) return;
    const measure = () => setDisplaySize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaleX = displaySize.w / page.img.width;
  const scaleY = displaySize.h / page.img.height;

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragKey || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleX;
    const y = (e.clientY - rect.top) / scaleY;
    setQuad((q) => ({ ...q, [dragKey]: {
      x: Math.max(0, Math.min(page.img.width, x)),
      y: Math.max(0, Math.min(page.img.height, y)),
    } }));
  };

  const handle = (key: keyof Quad, p: Point) => (
    <div
      key={key}
      onPointerDown={(e) => { e.preventDefault(); setDragKey(key); }}
      style={{ left: p.x * scaleX - 12, top: p.y * scaleY - 12 }}
      className="absolute h-6 w-6 cursor-grab touch-none rounded-full border-2 border-primary bg-background shadow-lg active:cursor-grabbing"
    />
  );

  const polyPoints = [quad.tl, quad.tr, quad.br, quad.bl]
    .map((p) => `${p.x * scaleX},${p.y * scaleY}`)
    .join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">تعديل الحواف والوضع</h3>
          <button onClick={onCancel} className="rounded-full p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          ref={wrapRef}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragKey(null)}
          onPointerLeave={() => setDragKey(null)}
          className="relative mx-auto select-none touch-none"
        >
          <img src={page.img.src} alt="scan" className="block max-h-[60vh] w-auto rounded-lg" />
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${displaySize.w} ${displaySize.h}`}
            preserveAspectRatio="none"
          >
            <polygon points={polyPoints} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
          </svg>
          {handle("tl", quad.tl)}
          {handle("tr", quad.tr)}
          {handle("br", quad.br)}
          {handle("bl", quad.bl)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                (mode === m.id ? "bg-primary text-primary-foreground" : "bg-secondary")
              }
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => setQuad(detectDocumentQuad(page.img))}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          >
            كشف تلقائي
          </button>
          <button
            onClick={() => setQuad(defaultQuad(page.img))}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          >
            إعادة تعيين
          </button>
          <button
            onClick={() => onSave(quad, mode)}
            className="mr-auto rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            تطبيق
          </button>
        </div>
      </div>
    </div>
  );
}
