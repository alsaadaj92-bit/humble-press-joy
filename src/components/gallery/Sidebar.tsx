import { Images, LibraryBig, Cloud, Settings, Search, Heart, Archive, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  onSearchClick: () => void;
  /** When true, remove the desktop-only "hidden md:flex" wrapper class */
  embedded?: boolean;
}

const items = [
  { id: "photos", label: "الصور", icon: Images },
  { id: "favorites", label: "المفضلة", icon: Heart },
  { id: "albums", label: "الألبومات", icon: LibraryBig },
  { id: "archive", label: "الأرشيف", icon: Archive },
  { id: "trash", label: "سلة المحذوفات", icon: Trash2 },
  { id: "providers", label: "مزودو التخزين", icon: Cloud },
  { id: "sync", label: "مركز المزامنة", icon: RefreshCw },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

export function GallerySidebar({ active, onSelect, onSearchClick, embedded }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground",
        !embedded && "hidden md:flex",
        embedded && "h-full w-full border-l-0",
      )}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Images className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">LocalGallery Pro</p>
          <p className="text-[11px] text-muted-foreground">بدون سحابة · خاص بك</p>
        </div>
      </div>

      <button
        onClick={onSearchClick}
        className="mx-3 mb-3 flex items-center gap-2 rounded-full bg-sidebar-accent px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span>ابحث في صورك</span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition",
                isActive
                  ? "bg-primary/15 font-semibold text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4 text-[11px] text-muted-foreground">
        اختصارات: F مفضلة · E أرشيف · Del حذف · / بحث
      </div>
    </aside>
  );
}
