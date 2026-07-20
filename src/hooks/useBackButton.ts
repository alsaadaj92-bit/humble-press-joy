import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Hardware back button handler for Android.
 * Runs the provided callback chain; if none returns true, exits the app.
 */
export function useBackButton(handler: () => boolean) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = App.addListener("backButton", () => {
      const handled = handler();
      if (!handled) {
        void App.exitApp().catch(() => undefined);
      }
    });
    return () => {
      void sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, [handler]);
}
