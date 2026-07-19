import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X, Plus, Minus, Locate } from "lucide-react";
import type { MockPhoto } from "@/lib/mockPhotos";
import { picsumThumb, picsumUrl } from "@/lib/mockPhotos";
import type { PhotoState } from "@/lib/photoDb";
import { clusterByLocation, type GeoPhoto, type PlaceCluster } from "@/lib/places";

const W = 640;
const H = 320;

function project(lat: number, lon: number) {
  return { x: ((lon + 180) / 360) * W, y: ((90 - lat) / 180) * H };
}

function thumb(p: MockPhoto) {
  return p.thumbSrc || picsumThumb(p.seed, 400);
}
function full(p: MockPhoto) {
  return p.fullSrc || p.thumbSrc || picsumUrl(p.seed, 1200, 900);
}

export function PlacesPanel({
  photos,
  states,
}: {
  photos: MockPhoto[];
  states: Map<string, PhotoState>;
}) {
  const geo = useMemo<GeoPhoto[]>(() => {
    const out: GeoPhoto[] = [];
    for (const p of photos) {
      const g = states.get(p.id)?.exif?.gps;
      if (g) out.push({ ...p, lat: g.lat, lon: g.lon });
    }
    return out;
  }, [photos, states]);

  const [openId, setOpenId] = useState<string | null>(null);

  // Interactive viewport: zoom (>=1) + center in map coords.
  const [view, setView] = useState({ zoom: 1, cx: W / 2, cy: H / 2 });
  const wrapRef = useRef<HTMLDivElement>(null);

  // Distance threshold shrinks with zoom so pins split apart as we zoom in.
  const clusterThreshold = 0.5 / view.zoom;
  const clusters = useMemo(() => clusterByLocation(geo, clusterThreshold), [geo, clusterThreshold]);
  const open = clusters.find((c) => c.id === openId) ?? null;

  // Current visible viewBox.
  const vbW = W / view.zoom;
  const vbH = H / view.zoom;
  const vbX = Math.max(0, Math.min(W - vbW, view.cx - vbW / 2));
  const vbY = Math.max(0, Math.min(H - vbH, view.cy - vbH / 2));

  const clampCenter = (cx: number, cy: number, zoom: number) => {
    const w = W / zoom;
    const h = H / zoom;
    return {
      cx: Math.max(w / 2, Math.min(W - w / 2, cx)),
      cy: Math.max(h / 2, Math.min(H - h / 2, cy)),
    };
  };

  // Wheel = zoom around cursor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width; // 0..1
      const py = (e.clientY - box.top) / box.height;
      const focalX = vbX + px * vbW;
      const focalY = vbY + py * vbH;
      const nextZoom = Math.max(1, Math.min(12, view.zoom * (1 - e.deltaY * 0.0015)));
      // Keep focal point stable on-screen after zoom.
      const newVbW = W / nextZoom;
      const newVbH = H / nextZoom;
      const newCx = focalX - (px - 0.5) * newVbW;
      const newCy = focalY - (py - 0.5) * newVbH;
      setView({ zoom: nextZoom, ...clampCenter(newCx, newCy, nextZoom) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, vbX, vbY, vbW, vbH]);

  // Drag to pan (mouse + single-touch).
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);

  const startDrag = (clientX: number, clientY: number) => {
    dragRef.current = { x: clientX, y: clientY, cx: view.cx, cy: view.cy };
  };
  const moveDrag = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const el = wrapRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const dx = ((clientX - d.x) / box.width) * vbW;
    const dy = ((clientY - d.y) / box.height) * vbH;
    setView((v) => ({ zoom: v.zoom, ...clampCenter(d.cx - dx, d.cy - dy, v.zoom) }));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onUp = () => endDrag();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        zoom: view.zoom,
        cx: view.cx,
        cy: view.cy,
      };
    } else if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const p = pinchRef.current;
      const nextZoom = Math.max(1, Math.min(12, p.zoom * (d / p.dist)));
      setView({ zoom: nextZoom, ...clampCenter(p.cx, p.cy, nextZoom) });
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchEnd = () => {
    pinchRef.current = null;
    endDrag();
  };

  const zoomBy = (factor: number) =>
    setView((v) => {
      const z = Math.max(1, Math.min(12, v.zoom * factor));
      return { zoom: z, ...clampCenter(v.cx, v.cy, z) };
    });

  const resetView = () => setView({ zoom: 1, cx: W / 2, cy: H / 2 });

  if (!geo.length) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <MapPin className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">لا توجد صور بإحداثيات موقع</h2>
        <p className="text-sm text-muted-foreground">
          عندما ترفع صوراً تحوي بيانات EXIF بموقع GPS ستظهر هنا على خريطة تعمل محلياً بالكامل.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/40 p-3">
        <div
          ref={wrapRef}
          className="relative touch-none select-none"
          onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-full rounded-md"
            role="img"
            aria-label="خريطة كل الأماكن"
          >
            <rect x={0} y={0} width={W} height={H} fill="hsl(var(--secondary))" />
            {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((m) => {
              const px = ((m + 180) / 360) * W;
              return (
                <line key={`m${m}`} x1={px} y1={0} x2={px} y2={H} stroke="hsl(var(--border))" strokeWidth={0.4 / view.zoom} opacity={0.5} />
              );
            })}
            {[-60, -30, 0, 30, 60].map((p) => {
              const py = ((90 - p) / 180) * H;
              return (
                <line key={`p${p}`} x1={0} y1={py} x2={W} y2={py} stroke="hsl(var(--border))" strokeWidth={0.4 / view.zoom} opacity={0.5} />
              );
            })}
            <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="hsl(var(--border))" strokeWidth={1 / view.zoom} />
            <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="hsl(var(--border))" strokeWidth={1 / view.zoom} />

            {clusters.map((c) => {
              const { x, y } = project(c.lat, c.lon);
              const r = Math.min(18, 6 + Math.log2(c.photos.length + 1) * 3) / Math.sqrt(view.zoom);
              return (
                <g
                  key={c.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    // Suppress open if the user actually dragged.
                    if (dragRef.current) return;
                    e.stopPropagation();
                    setOpenId(c.id);
                  }}
                >
                  <circle cx={x} cy={y} r={r + 4 / view.zoom} fill="hsl(var(--primary))" opacity={0.15} />
                  <circle cx={x} cy={y} r={r} fill="hsl(var(--primary))" opacity={0.55} />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10 / Math.sqrt(view.zoom)}
                    fontWeight={700}
                    fill="hsl(var(--primary-foreground))"
                  >
                    {c.photos.length}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Zoom controls */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 shadow backdrop-blur">
            <button
              onClick={() => zoomBy(1.5)}
              aria-label="تكبير"
              className="grid h-8 w-8 place-items-center rounded hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => zoomBy(1 / 1.5)}
              aria-label="تصغير"
              className="grid h-8 w-8 place-items-center rounded hover:bg-secondary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={resetView}
              aria-label="إعادة الضبط"
              className="grid h-8 w-8 place-items-center rounded hover:bg-secondary"
            >
              <Locate className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {clusters.length} موقع · {geo.length} صورة · تكبير {view.zoom.toFixed(1)}× · اسحب/كبّر بإصبعين أو Ctrl+عجلة
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {clusters.map((c) => (
          <PlaceCard key={c.id} cluster={c} onOpen={() => setOpenId(c.id)} />
        ))}
      </div>

      {open && <PlaceViewer cluster={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PlaceCard({ cluster, onOpen }: { cluster: PlaceCluster; onOpen: () => void }) {
  const preview = cluster.photos.slice(0, 4);
  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 text-right transition hover:border-primary/40 hover:bg-card"
    >
      <div className="grid h-20 w-20 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {preview.map((p) => (
          <img key={p.id} src={thumb(p)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <p className="truncate text-sm font-semibold">{cluster.label}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cluster.photos.length} صورة · {cluster.lat.toFixed(2)}°, {cluster.lon.toFixed(2)}°
        </p>
      </div>
    </button>
  );
}

function PlaceViewer({ cluster, onClose }: { cluster: PlaceCluster; onClose: () => void }) {
  const [i, setI] = useState(0);
  const p = cluster.photos[i];
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">{cluster.label}</p>
            <p className="text-[11px] text-white/70">
              {i + 1} / {cluster.photos.length} · {cluster.lat.toFixed(4)}°, {cluster.lon.toFixed(4)}°
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <img src={full(p)} alt={p.name} className="max-h-full max-w-full rounded-xl object-contain" />
      </div>

      <div
        className="scrollbar-thin flex gap-2 overflow-x-auto border-t border-white/10 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {cluster.photos.map((ph, idx) => (
          <button
            key={ph.id}
            onClick={() => setI(idx)}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-primary transition ${idx === i ? "ring-2" : "opacity-70 hover:opacity-100"}`}
          >
            <img src={thumb(ph)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
