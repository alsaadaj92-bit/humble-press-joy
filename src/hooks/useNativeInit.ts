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
    logTimeline("native", "init begin");

    void (async () => {
      try {
        // Immersive: WebView paints behind the status bar & nav bar.
        await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
        await StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => undefined);
      } catch { /* ignore */ }
      void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
    })();

    // Device-gallery import now uses the OS multi-select via
    // Camera.pickImages (see deviceMedia.ts). It requires an explicit user
    // gesture, so we DO NOT trigger it on launch — the empty-state button
    // and the FAB "import from gallery" action call it instead.

    // Preload on-device AI models if the user opted in via the wizard.
    void (async () => {
      const flag = await prefGet("lp:flag:aiPipeline");
      if (flag === "1") preloadInBackground();
    })();



    const runSync = () => {
      void runSyncCycle().catch(() => undefined);
    };

    const appSub = App.addListener("appStateChange", (s) => {
      logNative("app", `state ${s.isActive ? "active" : "background"}`);
      if (s.isActive) runSync();
    });
    const netSub = Network.addListener("networkStatusChange", (s) => {
      logNative("network", `${s.connected ? "online" : "offline"} (${s.connectionType})`);
      if (s.connected) runSync();
    });


    return () => {
      void appSub.then((h) => h.remove()).catch(() => undefined);
      void netSub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}

