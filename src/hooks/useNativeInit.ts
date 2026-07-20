import { useEffect } from "react";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Network } from "@capacitor/network";
import {
  checkCameraPermission,
  checkLocationPermission,
  checkNotifPermission,
  isNative,
  notify,
  requestCameraPermission,
  requestLocationPermission,
  requestNotifPermission,
} from "@/lib/native";
import { runSyncCycle } from "@/lib/syncEngine";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";
import { prefGet, prefSet } from "@/lib/native";

// Boots native-only integrations: status bar, splash, resume/network triggers.
// Safe on the web — every call short-circuits when Capacitor isn't present.
// Permission prompts keep re-firing on every launch until the user grants them,
// so a missed dialog on first launch is fixed the next time the app opens.
export function useNativeInit() {
  useEffect(() => {
    if (!isNative()) return;

    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#0b0b0b" }).catch(() => undefined);
    void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);

    void (async () => {
      // Wait a beat so the WebView is fully attached before the OS dialog opens
      // (some OEMs swallow prompts fired too early after launch).
      await new Promise((r) => setTimeout(r, 600));

      const askIfNeeded = async (
        check: () => Promise<"granted" | "denied" | "prompt" | "unknown">,
        request: () => Promise<boolean>,
      ) => {
        try {
          const s = await check();
          if (s === "granted") return true;
          // Re-request unless the user explicitly denied and the OS won't show
          // the dialog again — the request call is a no-op in that case, safe.
          return await request();
        } catch {
          return false;
        }
      };

      const camOk = await askIfNeeded(checkCameraPermission, requestCameraPermission);
      await askIfNeeded(checkNotifPermission, requestNotifPermission);
      await askIfNeeded(checkLocationPermission, requestLocationPermission);

      if (camOk) {
        void notify(
          "Localphotos Pro جاهز",
          "جاري تحميل صور معرض هاتفك — قد تستغرق العملية لحظات.",
        ).catch(() => undefined);
      }

      // First-launch auto-scan of the device gallery. Only mark "done" when
      // we actually imported something — otherwise retry on the next launch.
      try {
        if (canScanDeviceGallery()) {
          const done = await prefGet("lp:firstScanDone");
          if (!done) {
            const n = await scanDeviceGallery();
            if (n > 0) {
              await prefSet("lp:firstScanDone", "1");
              void notify("تم استيراد الصور", `أُدرجت ${n} عنصراً من المعرض.`).catch(
                () => undefined,
              );
            }
          }
        }
      } catch {
        /* ignore — user can re-run from Permissions panel */
      }
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
