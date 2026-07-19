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

/** Tailwind class map for masonry columns per density breakpoint. */
export function densityColClasses(density: GridDensity) {
  switch (density) {
    case "large":
      return "masonry-col-2 sm:masonry-col-3 md:masonry-col-4 lg:masonry-col-4 xl:masonry-col-5";
    case "compact":
      return "masonry-col-4 sm:masonry-col-6 md:masonry-col-7 lg:masonry-col-8 xl:masonry-col-10";
    case "comfortable":
    default:
      return "masonry-col-3 sm:masonry-col-4 md:masonry-col-5 lg:masonry-col-6 xl:masonry-col-7";
  }
}
