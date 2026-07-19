import { useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
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

  const clusters = useMemo(() => clusterByLocation(geo, 0.5), [geo]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = clusters.find((c) => c.id === openId) ?? null;

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
      <div className="overflow-hidden rounded-2xl border border-border bg-secondary/40 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full rounded-md"
          role="img"
          aria-label="خريطة كل الأماكن"
        >
          <rect x={0} y={0} width={W} height={H} fill="hsl(var(--secondary))" />
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((m) => {
            const px = ((m + 180) / 360) * W;
            return (
              <line key={`m${m}`} x1={px} y1={0} x2={px} y2={H} stroke="hsl(var(--border))" strokeWidth={0.4} opacity={0.5} />
            );
          })}
          {[-60, -30, 0, 30, 60].map((p) => {
            const py = ((90 - p) / 180) * H;
            return (
              <line key={`p${p}`} x1={0} y1={py} x2={W} y2={py} stroke="hsl(var(--border))" strokeWidth={0.4} opacity={0.5} />
            );
          })}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="hsl(var(--border))" />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="hsl(var(--border))" />

          {clusters.map((c) => {
            const { x, y } = project(c.lat, c.lon);
            const r = Math.min(18, 6 + Math.log2(c.photos.length + 1) * 3);
            return (
              <g key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                <circle cx={x} cy={y} r={r + 4} fill="hsl(var(--primary))" opacity={0.15} />
                <circle cx={x} cy={y} r={r} fill="hsl(var(--primary))" opacity={0.55} />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={700}
                  fill="hsl(var(--primary-foreground))"
                >
                  {c.photos.length}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {clusters.length} موقع · {geo.length} صورة بإحداثيات · اضغط على أي دائرة لعرض الصور
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
