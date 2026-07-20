import { Images, LibraryBig, Search, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Google Photos-style 4-tab bottom nav (Photos / Search / Sharing / Library).
const items = [
  { id: "photos", label: "الصور", icon: Images },
  { id: "smart", label: "بحث", icon: Search },
  { id: "sharing", label: "مشاركة", icon: Share2 },
  { id: "library", label: "المكتبة", icon: LibraryBig },
];


export function MobileNav({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "grid h-8 w-14 place-items-center rounded-full transition",
                isActive && "bg-primary/15",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
