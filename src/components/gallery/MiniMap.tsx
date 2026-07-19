// Self-contained mini-map. Renders a graticule world map inline as SVG.
// No external tiles, no network requests — respects the Zero-Cloud policy.
interface MiniMapProps {
  lat: number;
  lon: number;
  className?: string;
}

const W = 320;
const H = 160;

// Equirectangular projection: lon [-180,180] -> [0,W], lat [90,-90] -> [0,H]
function project(lat: number, lon: number) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

export function MiniMap({ lat, lon, className }: MiniMapProps) {
  const { x, y } = project(lat, lon);

  // Graticule every 30°
  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const parallels = [-60, -30, 0, 30, 60];

  const hemLatLabel = lat >= 0 ? "شمال" : "جنوب";
  const hemLonLabel = lon >= 0 ? "شرق" : "غرب";

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full rounded-md border border-border bg-[hsl(var(--secondary))]"
        role="img"
        aria-label={`الموقع: خط عرض ${lat.toFixed(4)}، خط طول ${lon.toFixed(4)}`}
      >
        {/* Ocean background */}
        <rect x={0} y={0} width={W} height={H} fill="hsl(var(--secondary))" />

        {/* Equator + prime meridian emphasized */}
        <line
          x1={0}
          y1={H / 2}
          x2={W}
          y2={H / 2}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
        <line
          x1={W / 2}
          y1={0}
          x2={W / 2}
          y2={H}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {/* Meridians */}
        {meridians.map((m) => {
          const px = ((m + 180) / 360) * W;
          return (
            <line
              key={`m${m}`}
              x1={px}
              y1={0}
              x2={px}
              y2={H}
              stroke="hsl(var(--border))"
              strokeWidth={0.4}
              opacity={0.5}
            />
          );
        })}

        {/* Parallels */}
        {parallels.map((p) => {
          const py = ((90 - p) / 180) * H;
          return (
            <line
              key={`p${p}`}
              x1={0}
              y1={py}
              x2={W}
              y2={py}
              stroke="hsl(var(--border))"
              strokeWidth={0.4}
              opacity={0.5}
            />
          );
        })}

        {/* Pin: outer glow ring + inner dot */}
        <circle
          cx={x}
          cy={y}
          r={10}
          fill="hsl(var(--primary))"
          opacity={0.18}
        />
        <circle
          cx={x}
          cy={y}
          r={5}
          fill="hsl(var(--primary))"
          opacity={0.35}
        />
        <circle
          cx={x}
          cy={y}
          r={2.5}
          fill="hsl(var(--primary))"
          stroke="hsl(var(--card))"
          strokeWidth={0.8}
        />
      </svg>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {Math.abs(lat).toFixed(4)}° {hemLatLabel}
        </span>
        <span>
          {Math.abs(lon).toFixed(4)}° {hemLonLabel}
        </span>
      </div>
    </div>
  );
}
