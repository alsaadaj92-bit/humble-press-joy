import { useCallback, useEffect, useState } from "react";
import { MobileNav, type Tab } from "@/components/gallery/MobileNav";
import { SyncScreen } from "@/components/gallery/SyncScreen";
import { TelegramScreen } from "@/components/gallery/TelegramScreen";
import { SettingsPage } from "@/components/gallery/SettingsPage";
import { DiagnosticsPage } from "@/components/gallery/DiagnosticsPage";
import { PermissionsWizard } from "@/components/gallery/PermissionsWizard";
import { useSyncLoop } from "@/hooks/useSyncEngine";
import { useNativeInit } from "@/hooks/useNativeInit";
import { useBackButton } from "@/hooks/useBackButton";

const TAB_KEY = "ui:activeTab";
type Route = Tab | "diagnostics";

function loadTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === "sync" || v === "telegram" || v === "settings") return v;
  } catch { /* noop */ }
  return "sync";
}

const Index = () => {
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [route, setRoute] = useState<Route>(tab);
  useSyncLoop();
  useNativeInit();

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    setRoute(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* noop */ }
  }, [tab]);

  const back = useCallback(() => {
    if (route === "diagnostics") { setRoute("settings"); return true; }
    if (route === "settings") { setTab("sync"); return true; }
    if (route === "telegram") { setTab("sync"); return true; }
    return false;
  }, [route, setTab]);
  useBackButton(back);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <main className="min-h-screen">
        {/* Keep persistent tabs mounted so scroll and feed state survive switches. */}
        <div style={{ display: route === "sync" ? "block" : "none" }}>
          <SyncScreen />
        </div>
        <div style={{ display: route === "telegram" ? "block" : "none" }}>
          <TelegramScreen />
        </div>
        {route === "settings" && (
          <SettingsPage
            onBack={() => setTab("sync")}
            onOpenDiagnostics={() => setRoute("diagnostics")}
          />
        )}
        {route === "diagnostics" && (
          <DiagnosticsPage onBack={() => setRoute("settings")} />
        )}
      </main>
      {route !== "settings" && route !== "diagnostics" && (
        <MobileNav active={tab} onChange={setTab} />
      )}
      <PermissionsWizard />
    </div>
  );
};

export default Index;
