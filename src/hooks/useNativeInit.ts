import { useEffect } from "react";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Network } from "@capacitor/network";
import {
  isNative,
  notify,
  prefGet,
  prefSet,
  requestCameraPermission,
  requestNotifPermission,
  requestLocationPermission,
} from "@/lib/native";
import { runSyncCycle } from "@/lib/syncEngine";

const FIRST_RUN_KEY = "lgp:firstRunDone";

// Boots native-only integrations: status bar, splash, resume/network triggers.
// Safe on the web — every call short-circuits when Capacitor isn't present.
export function useNativeInit() {
  useEffect(() => {
    if (!isNative()) return;

    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#0b0b0b" }).catch(() => undefined);
    void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);

    // First-launch: proactively fire native permission prompts so the user
    // actually sees the OS dialogs. Without an explicit request, Android/iOS
    // never surface them.
    void (async () => {
      const done = await prefGet(FIRST_RUN_KEY);
      if (done === "1") return;
      try { await requestNotifPermission(); } catch { /* denied */ }
      try { await requestCameraPermission(); } catch { /* denied */ }
      try { await requestLocationPermission(); } catch { /* denied */ }
      await prefSet(FIRST_RUN_KEY, "1");
      void notify(
        "Localphotos Pro جاهز",
        "امنح الأذونات ثم اضغط زر + لاستيراد صور من معرض هاتفك",
      ).catch(() => undefined);
    })();

    const runSync = () => {
      void runSyncCycle().catch(() => undefined);
    };

    const appSub = App.addListener("appStateChange", (s) => {
      if (s.isActive) runSync();
    });
    const netSub = Network.addListener("networkStatusChange", (s) => {
      if (s.connected) runSync();
    });

    return () => {
      void appSub.then((h) => h.remove()).catch(() => undefined);
      void netSub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}
