// One-shot preloader for every on-device AI model the app uses.
// Called in the background after the first-launch permissions wizard so that
// Face Recognition, Semantic Search (CLIP) and OCR are ready to run offline —
// especially important inside the Android APK, where the first cold-load of
// each model would otherwise appear as "nothing happens" to the user.
//
// All model weights are cached by their respective libraries (face-api uses
// fetch → HTTP cache, transformers.js uses the browser Cache API, tesseract
// stores its trained data in IndexedDB). Subsequent launches skip network.

import { toast } from "sonner";

export type PreloadStage = "faces" | "clip" | "ocr";
export interface PreloadEvent {
  stage: PreloadStage;
  status: "start" | "done" | "error";
  message?: string;
}

let started = false;
let finished = false;

export function areModelsPreloaded() {
  return finished;
}

export async function preloadAiModels(
  onEvent?: (e: PreloadEvent) => void,
): Promise<void> {
  if (started) return;
  started = true;

  const emit = (e: PreloadEvent) => {
    try { onEvent?.(e); } catch { /* ignore */ }
  };

  // Faces — 3 tiny nets, ~2 MB total.
  try {
    emit({ stage: "faces", status: "start" });
    const { loadFaceModels } = await import("./faces");
    await loadFaceModels();
    emit({ stage: "faces", status: "done" });
  } catch (err) {
    emit({ stage: "faces", status: "error", message: String(err) });
  }

  // CLIP — ~90 MB, biggest one. Run in background; failures are non-fatal.
  try {
    emit({ stage: "clip", status: "start" });
    const { loadClip } = await import("./semantic");
    await loadClip();
    emit({ stage: "clip", status: "done" });
  } catch (err) {
    emit({ stage: "clip", status: "error", message: String(err) });
  }

  // OCR — Arabic + English trained data (~15 MB).
  try {
    emit({ stage: "ocr", status: "start" });
    // Touch the module — the worker/langs download on first .recognize() call.
    // We warm the worker here so the langs land in IndexedDB now.
    const mod = await import("./ocr");
    // Recognizing a tiny transparent pixel primes the worker + langs.
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 8;
    await mod.ocrImage(canvas);
    emit({ stage: "ocr", status: "done" });
  } catch (err) {
    emit({ stage: "ocr", status: "error", message: String(err) });
  }

  finished = true;
}

/** Fire-and-forget preload with a subtle toast. Safe to call multiple times. */
export function preloadInBackground() {
  if (started) return;
  const t = toast.loading("جاري تحضير أدوات الذكاء الاصطناعي محلياً…", {
    duration: 60_000,
  });
  void preloadAiModels((e) => {
    if (e.status === "done" && e.stage === "ocr") {
      toast.dismiss(t);
      toast.success("جاهز — الوجوه والبحث الذكي وقراءة النصوص تعمل بدون إنترنت");
    }
  }).catch(() => {
    toast.dismiss(t);
  });
}
