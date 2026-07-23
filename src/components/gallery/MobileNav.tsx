import { Cloud, Settings as SettingsIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "sync" | "telegram" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Upload }[] = [
  { id: "sync", label: "للمزامنة", icon: Upload },
  { id: "telegram", label: "معرض تليكرام", icon: Cloud },
  { id: "settings", label: "الإعدادات", icon: SettingsIcon },
];

interface MobileNavProps {
  active: Tab;
  onChange: (t: Tab) => void;
}

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 backdrop-blur safe-bottom">
      {TABS.map((t) => {
        const Icon = t.icon;
        const activeTab = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
              activeTab ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", activeTab && "scale-110")} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
