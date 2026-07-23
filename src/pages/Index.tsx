import { useCallback, useState } from "react";
import { MobileNav, type Tab } from "@/components/gallery/MobileNav";
import { SyncScreen } from "@/components/gallery/SyncScreen";
import { TelegramScreen } from "@/components/gallery/TelegramScreen";
import { SettingsPage } from "@/components/gallery/SettingsPage";
import { PermissionsWizard } from "@/components/gallery/PermissionsWizard";
import { useSyncLoop } from "@/hooks/useSyncEngine";
import { useNativeInit } from "@/hooks/useNativeInit";
import { useBackButton } from "@/hooks/useBackButton";

const Index = () => {
  const [tab, setTab] = useState<Tab>("sync");
  useSyncLoop();
  useNativeInit();

  const back = useCallback(() => {
    if (tab === "settings") { setTab("sync"); return true; }
    if (tab === "telegram") { setTab("sync"); return true; }
    return false;
  }, [tab]);
  useBackButton(back);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <main className="min-h-screen">
        {tab === "sync" && <SyncScreen />}
        {tab === "telegram" && <TelegramScreen />}
        {tab === "settings" && <SettingsPage onBack={() => setTab("sync")} />}
      </main>
      {tab !== "settings" && <MobileNav active={tab} onChange={setTab} />}
      <PermissionsWizard />
    </div>
  );
};

export default Index;
