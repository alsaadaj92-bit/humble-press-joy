import { useEffect } from "react";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Network } from "@capacitor/network";
import { isNative, notify } from "@/lib/native";
import { runSyncCycle } from "@/lib/syncEngine";

// Boots native-only integrations: status bar, splash, resume/network triggers.
// Safe on the web — every call short-circuits when Capacitor isn't present.
export function useNativeInit() {
  useEffect(() => {
    if (!isNative()) return;

    // Style the native shell.
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#0b0b0b" }).catch(() => undefined);
    void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);

    // Kick the sync loop whenever the app returns to the foreground or
    // network becomes available. This is our "background sync" surrogate on
    // devices that heavily throttle real background tasks.
    const runSync = () => {
      void runSyncCycle().catch(() => undefined);
    };

    const appSub = App.addListener("appStateChange", (s) => {
      if (s.isActive) runSync();
    });
    const netSub = Network.addListener("networkStatusChange", (s) => {
      if (s.connected) runSync();
    });

    // First launch — offer a friendly welcome notification.
    void notify("LocalGallery Pro جاهز", "كل بياناتك تبقى داخل جهازك — بدون أي سحابة").catch(
      () => undefined,
    );

    return () => {
      void appSub.then((h) => h.remove()).catch(() => undefined);
      void netSub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}
