import { useEffect, useRef, useState } from "react";
import { Brush, Download, Eraser, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { eraseToBlob } from "@/lib/magicEraser";

// Local-only Magic Eraser: brush a mask, then diffuse-inpaint the region.
// Nothing leaves the browser — the source image is loaded into a canvas and
// processed with a pure JS algorithm.

const MAX_SIDE = 1400;

export function MagicEraserPanel() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgName, setImgName] = useState<string>("image.png");
  const [brush, setBrush] = useState(28);
  const [busy, setBusy] = useState(false);
  const [passes, setPasses] = useState(40);
  const [feather, setFeather] = useState(2);
  const [result, setResult] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);   // display + hit-testing
  const maskRef = useRef<HTMLCanvasElement | null>(null);     // full-res mask
  const overlayRef = useRef<HTMLCanvasElement | null>(null);  // display-size mask overlay
  const drawing = useRef(false);
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => () => {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    if (result) URL.revokeObjectURL(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = (file: File) => {
    if (result) URL.revokeObjectURL(result);
    setResult(null);
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setImgName(file.name);
  };

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const maxSide = Math.max(w, h);
    const scale = maxSide > MAX_SIDE ? MAX_SIDE / maxSide : 1;
    const dispW = Math.round(w * scale);
    const dispH = Math.round(h * scale);
    setDisplayScale(scale);

    const cv = canvasRef.current!;
    cv.width = dispW;
    cv.height = dispH;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, dispW, dispH);

    // Full-res mask (matches natural image size — inpainting quality).
    const m = document.createElement("canvas");
    m.width = w;
    m.height = h;
    maskRef.current = m;

    const ov = overlayRef.current!;
    ov.width = dispW;
    ov.height = dispH;
    ov.getContext("2d")!.clearRect(0, 0, dispW, dispH);
  };

  const paintAt = (clientX: number, clientY: number) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = (clientX - rect.left) * (cv.width / rect.width);
    const y = (clientY - rect.top) * (cv.height / rect.height);

    // overlay (display resolution)
    const octx = overlayRef.current!.getContext("2d")!;
    octx.fillStyle = "rgba(239,68,68,0.55)";
    octx.beginPath();
    octx.arc(x, y, brush / 2, 0, Math.PI * 2);
    octx.fill();

    // mask (natural resolution)
    const m = maskRef.current!;
    const mctx = m.getContext("2d")!;
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.arc(x / displayScale, y / displayScale, brush / 2 / displayScale, 0, Math.PI * 2);
    mctx.fill();
  };

  const onDown = (e: React.PointerEvent) => {
    if (!imgUrl) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    paintAt(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    paintAt(e.clientX, e.clientY);
  };
  const onUp = () => (drawing.current = false);

  const clearMask = () => {
    if (!overlayRef.current || !maskRef.current) return;
    overlayRef.current.getContext("2d")!.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    maskRef.current.getContext("2d")!.clearRect(0, 0, maskRef.current.width, maskRef.current.height);
  };

  const runErase = async () => {
    if (!imgRef.current || !maskRef.current) return;
    setBusy(true);
    try {
      const m = maskRef.current;
      const mctx = m.getContext("2d")!;
      const mData = mctx.getImageData(0, 0, m.width, m.height);
      // reduce mask to single-channel (use alpha or red)
      const mask = new Uint8ClampedArray(m.width * m.height);
      let any = false;
      for (let i = 0; i < mask.length; i++) {
        const v = mData.data[i * 4 + 3]; // alpha
        mask[i] = v > 8 ? 255 : 0;
        if (mask[i]) any = true;
      }
      if (!any) {
        toast.error("ارسم فوق المنطقة المراد إزالتها أولاً");
        return;
      }
      // Yield so spinner paints.
      await new Promise((r) => setTimeout(r, 0));
      const blob = await eraseToBlob(imgRef.current, mask, m.width, m.height, {
        passes,
        feather,
      });
      if (result) URL.revokeObjectURL(result);
      const url = URL.createObjectURL(blob);
      setResult(url);
      toast.success("تم — كل المعالجة تمت داخل متصفحك");
    } catch (e) {
      toast.error("فشلت المعالجة: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    const dot = imgName.lastIndexOf(".");
    const base = dot > 0 ? imgName.slice(0, dot) : imgName;
    a.download = `${base}-erased.png`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Upload className="h-4 w-4" />
          صورة
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
        </label>
        <div className="flex items-center gap-2 text-sm">
          <Brush className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={6}
            max={120}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
          />
          <span className="w-8 text-center text-xs">{brush}px</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          دقة:
          <input
            type="range"
            min={10}
            max={80}
            value={passes}
            onChange={(e) => setPasses(Number(e.target.value))}
          />
          <span className="w-6 text-center">{passes}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          نعومة الحواف:
          <input
            type="range"
            min={0}
            max={8}
            value={feather}
            onChange={(e) => setFeather(Number(e.target.value))}
          />
          <span className="w-6 text-center">{feather}</span>
        </div>
        <button
          onClick={clearMask}
          className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
        >
          <RotateCcw className="h-3.5 w-3.5" /> مسح الفرشاة
        </button>
        <button
          onClick={runErase}
          disabled={busy || !imgUrl}
          className="mr-auto flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          {busy ? "جارِ المعالجة…" : "امحُ المنطقة"}
        </button>
      </div>

      {imgUrl ? (
        <div className="relative mx-auto max-w-full overflow-auto rounded-2xl border border-border bg-black/60">
          {/* hidden loader */}
          <img
            ref={imgRef}
            src={imgUrl}
            alt=""
            onLoad={onImgLoad}
            className="hidden"
            crossOrigin="anonymous"
          />
          <div
            className="relative touch-none select-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <canvas ref={canvasRef} className="block max-w-full" />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 max-w-full"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          اختر صورة، ارسم بالفرشاة فوق العنصر المراد إزالته، ثم اضغط "امحُ المنطقة".
          كل المعالجة تتم محلياً داخل متصفحك بخوارزمية انتشار (diffusion inpainting).
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">النتيجة</h3>
            <button
              onClick={download}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" /> تنزيل PNG
            </button>
          </div>
          <img src={result} alt="erased" className="mx-auto max-h-[70vh] rounded-lg" />
        </div>
      )}
    </div>
  );
}
