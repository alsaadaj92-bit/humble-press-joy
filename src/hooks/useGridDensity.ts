import { useCallback, useEffect, useState } from "react";

export type GridDensity = "large" | "comfortable" | "compact";

const KEY = "lgp-grid-density";

export function useGridDensity(initial: GridDensity = "comfortable") {
  const [density, setDensityState] = useState<GridDensity>(() => {
    if (typeof window === "undefined") return initial;
    const v = window.localStorage.getItem(KEY);
    return (v === "large" || v === "compact" || v === "comfortable") ? v : initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, density);
    } catch {
      /* ignore quota */
    }
  }, [density]);

  const setDensity = useCallback((d: GridDensity) => setDensityState(d), []);

  return { density, setDensity };
}

/** Tailwind class map for masonry columns per density breakpoint.
 *  Tuned for full-bleed layout: fills 1920px+ screens edge-to-edge. */
export function densityColClasses(density: GridDensity) {
  switch (density) {
    case "large":
      return "masonry-col-2 sm:masonry-col-3 md:masonry-col-4 lg:masonry-col-5 xl:masonry-col-6 2xl:masonry-col-7 3xl:masonry-col-8";
    case "compact":
      return "masonry-col-4 sm:masonry-col-6 md:masonry-col-8 lg:masonry-col-10 xl:masonry-col-10 2xl:masonry-col-12 3xl:masonry-col-12";
    case "comfortable":
    default:
      return "masonry-col-3 sm:masonry-col-4 md:masonry-col-6 lg:masonry-col-7 xl:masonry-col-8 2xl:masonry-col-9 3xl:masonry-col-10";
  }
}

