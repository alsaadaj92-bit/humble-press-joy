/**
 * Global LIFO stack of back-button handlers.
 * Components (Lightbox, modals, wizards) push a handler while open and pop it
 * on unmount. `runTopHandler()` returns true if a handler consumed the event.
 */
type Handler = () => boolean | void;
const stack: Handler[] = [];

export function pushBackHandler(fn: Handler): () => void {
  stack.push(fn);
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function runTopHandler(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      const handled = stack[i]();
      if (handled) return true;
    } catch { /* ignore */ }
  }
  return false;
}
