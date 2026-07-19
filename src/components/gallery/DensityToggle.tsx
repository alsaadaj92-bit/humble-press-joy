import { Rows3, LayoutGrid, Grid3x3 } from "lucide-react";
import type { GridDensity } from "@/hooks/useGridDensity";
import { cn } from "@/lib/utils";

interface Props {
  density: GridDensity;
  onChange: (d: GridDensity) => void;
}

const OPTS: { id: GridDensity; label: string; icon: typeof Rows3 }[] = [
  { id: "large", label: "كبير", icon: Rows3 },
  { id: "comfortable", label: "مريح", icon: LayoutGrid },
  { id: "compact", label: "مضغوط", icon: Grid3x3 },
];

/** Google Photos-style zoom control — three tile densities. */
export function DensityToggle({ density, onChange }: Props) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card/60 p-0.5"
      role="radiogroup"
      aria-label="حجم الشبكة"
    >
      {OPTS.map((o) => {
        const Icon = o.icon;
        const active = density === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.id)}
            className={cn(
              "grid h-7 w-8 place-items-center rounded-full text-xs transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
