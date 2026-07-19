/**
 * Wrap a state update in the View Transitions API when available.
 * Enables Shared Element-like morph between grid tile and Lightbox image.
 * Falls back to a plain call when the API isn't supported.
 */
export function runViewTransition(fn: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    doc.startViewTransition(fn);
  } else {
    fn();
  }
}
