import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { runTopHandler } from "@/lib/backStack";
import { toast } from "sonner";

let lastBackAt = 0;

/**
 * Hardware back button handler for Android.
 * Priority: global back stack (open lightbox / modals) → provided handler
 * (screen-level like changing tab) → double-tap to exit.
 */
export function useBackButton(handler: () => boolean) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = App.addListener("backButton", () => {
      if (runTopHandler()) return;
      if (handler()) return;
      const now = Date.now();
      if (now - lastBackAt < 2000) {
        void App.exitApp().catch(() => undefined);
        return;
      }
      lastBackAt = now;
      try { toast("اضغط مرة أخرى للخروج"); } catch { /* noop */ }
    });
    return () => {
      void sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, [handler]);
}
