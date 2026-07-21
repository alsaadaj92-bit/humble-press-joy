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
  requestCameraPermission,
  requestLocationPermission,
  requestNotifPermission,
} from "@/lib/native";
import { runSyncCycle } from "@/lib/syncEngine";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";
import { prefGet } from "@/lib/native";
import { preloadInBackground } from "@/lib/preloadModels";
import { logNative, logTimeline } from "@/lib/diagnostics";

/**
 * Native init:
 * - Edge-to-edge immersive (StatusBar overlays WebView, transparent).
 * - Splash hide.
 * - Silent permission checks (the PermissionsWizard handles the actual asks).
 * - Automatic device-gallery scans on launch and on every app resume.
 * - Sync triggers on network change / resume.
 */
export function useNativeInit() {
  useEffect(() => {
    if (!isNative()) return;
    logTimeline("native init: begin");

    void (async () => {
      try {
        // Immersive: WebView paints behind the status bar & nav bar.
        await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
        await StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => undefined);
      } catch { /* ignore */ }
      void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
    })();

    // Kick off a background scan whenever the app opens or resumes — this
    // ensures newly-added photos in the phone gallery appear here without a
    // manual action, just like Google Photos.
    const runScan = () => {
      void (async () => {
        try {
          if (!canScanDeviceGallery()) return;
          // Don't gate on camera perm — the Media plugin has its own perm.
          // If it's missing the call throws and we swallow silently.
          await scanDeviceGallery();
        } catch { /* ignore */ }
      })();
    };

    // Preload on-device AI models if the user opted in via the wizard.
    void (async () => {
      const flag = await prefGet("lp:flag:aiPipeline");
      if (flag === "1") preloadInBackground();
    })();

    // First tick — wait a beat so wizard/permissions can settle.
    const t = window.setTimeout(runScan, 1200);

    const runSync = () => {
      void runSyncCycle().catch(() => undefined);
    };

    const appSub = App.addListener("appStateChange", (s) => {
      logNative("app", `state ${s.isActive ? "active" : "background"}`);
      if (s.isActive) {
        runSync();
        runScan();
      }
    });
    const netSub = Network.addListener("networkStatusChange", (s) => {
      logNative("network", `${s.connected ? "online" : "offline"} (${s.connectionType})`);
      if (s.connected) runSync();
    });

    // Silently re-check permissions on resume (no dialog if already answered).
    const permSub = App.addListener("appStateChange", async (s) => {
      if (!s.isActive) return;
      try {
        if ((await checkCameraPermission()) === "prompt") await requestCameraPermission();
        if ((await checkNotifPermission()) === "prompt") await requestNotifPermission();
        if ((await checkLocationPermission()) === "prompt") await requestLocationPermission();
      } catch { /* ignore */ }
    });

    return () => {
      window.clearTimeout(t);
      void appSub.then((h) => h.remove()).catch(() => undefined);
      void netSub.then((h) => h.remove()).catch(() => undefined);
      void permSub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}
