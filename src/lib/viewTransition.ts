/**
 * Wrap a state update in the View Transitions API when available.
 * - Serializes transitions (starting a new one while one is running would throw
 *   `InvalidStateError: Transition was aborted because of invalid state`).
 * - Swallows aborted-transition errors so they never bubble as unhandled
 *   promise rejections (which can crash the Android WebView).
 * - Falls back to a plain call when the API is unavailable or user prefers
 *   reduced motion.
 */
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => {
    finished: Promise<void>;
    ready?: Promise<void>;
    skipTransition?: () => void;
  };
};

let running: Promise<void> | null = null;

export function runViewTransition(fn: () => void): void {
  const doc = document as DocWithVT;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (typeof doc.startViewTransition !== "function" || reduce) {
    try { fn(); } catch { /* noop */ }
    return;
  }

  const start = () => {
    try {
      const t = doc.startViewTransition!(fn);
      const p = t.finished.catch(() => undefined);
      running = p.finally(() => {
        if (running === p) running = null;
      });
    } catch {
      // Some browsers throw synchronously if called during another transition.
      try { fn(); } catch { /* noop */ }
      running = null;
    }
  };

  if (running) {
    // Queue after the current one; if it never resolves in reasonable time,
    // fall back to a plain call to avoid deadlocking UI.
    const waiter = running;
    let ran = false;
    const timeout = setTimeout(() => {
      if (ran) return;
      ran = true;
      try { fn(); } catch { /* noop */ }
    }, 500);
    void waiter.then(() => {
      if (ran) return;
      ran = true;
      clearTimeout(timeout);
      start();
    });
    return;
  }
  start();
}
