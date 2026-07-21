import {
  Images,
  LibraryBig,
  Cloud,
  Settings,
  Search,
  Heart,
  Archive,
  Trash2,
  RefreshCw,
  Sparkles,
  MapPin,
  Copy,
  Brain,
  UserRound,
  ScanText,
  Share2,
  Compass,
  Wrench,
  Play,
  ScanLine,

  Camera,
  Star,
  Video,
  Users,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  onSearchClick: () => void;
  /** When true, remove the desktop-only "hidden md:flex" wrapper class */
  embedded?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Images;
  /** Feature isn't wired yet — hide by default. */
  stub?: boolean;
  /** Only meaningful on the native Android/iOS build. */
  nativeOnly?: boolean;
}

interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

// Mirrors Google Photos' primary IA: Photos → Sharing → Library (with Explore nested).
const GROUPS: NavGroup[] = [
  {
    id: "main",
    items: [
      { id: "photos", label: "الصور", icon: Images },
      { id: "memories", label: "الذكريات", icon: Sparkles },
      { id: "sharing", label: "المشاركة", icon: Share2, stub: true },
    ],
  },
  {
    id: "categories",
    label: "التصنيفات",
    items: [
      { id: "videos", label: "الفيديوهات", icon: Video },
      { id: "selfies", label: "السيلفي", icon: Camera },
      { id: "screenshots", label: "لقطات الشاشة", icon: Camera },
      { id: "creations", label: "أفلام ومجمعات", icon: Play },
      { id: "scanner", label: "ماسح المستندات", icon: ScanLine },
      { id: "eraser", label: "الممحاة السحرية", icon: Wrench },
      { id: "live-albums", label: "ألبومات حية", icon: Sparkles },
    ],
  },
  {
    id: "library",
    label: "المكتبة",
    items: [
      { id: "library", label: "نظرة عامة", icon: LibraryBig },
      { id: "albums", label: "الألبومات", icon: LibraryBig },
      { id: "people", label: "الأشخاص والحيوانات", icon: UserRound },
      { id: "places", label: "الأماكن", icon: MapPin },
      { id: "things", label: "الأشياء", icon: Compass, stub: true },
      { id: "smart", label: "بحث ذكي (AI)", icon: Brain },
      { id: "ocr", label: "قراءة النصوص", icon: ScanText },
      { id: "favorites", label: "المفضلة", icon: Heart },
      { id: "starred", label: "المميّزة بنجمة", icon: Star, stub: true },
      { id: "duplicates", label: "التكرارات", icon: Copy },
      { id: "locked", label: "المجلد المؤمَّن", icon: Lock },
      { id: "archive", label: "الأرشيف", icon: Archive },
      { id: "trash", label: "سلة المحذوفات", icon: Trash2 },
    ],
  },
  {
    id: "utilities",
    label: "أدوات",
    items: [
      { id: "providers", label: "مزودو التخزين", icon: Cloud },
      { id: "sync", label: "مركز المزامنة", icon: RefreshCw },
      { id: "partner", label: "الشريك", icon: Users, stub: true },
      { id: "print", label: "متجر الطباعة", icon: Wrench, stub: true, nativeOnly: true },
      { id: "permissions", label: "الأذونات (تطبيق أصلي)", icon: Lock, nativeOnly: true },
      { id: "settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

export function GallerySidebar({ active, onSelect, onSearchClick, embedded }: SidebarProps) {
  // Filter out stubs (not wired yet) and native-only items on web.
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const isNativeApp = typeof cap?.isNativePlatform === "function" && cap.isNativePlatform();
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => !it.stub && (!it.nativeOnly || isNativeApp)),
  })).filter((g) => g.items.length > 0);
  return (
    <aside
      className={cn(
        "flex w-72 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground",
        !embedded && "hidden md:flex",
        embedded && "h-full w-full border-l-0",
      )}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Images className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Localphotos Pro</p>
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

      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <div key={group.id}>
            {group.label && (
              <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
                    <span className="flex-1 text-right">{item.label}</span>
                    {item.stub && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        قريباً
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-muted-foreground">
        F مفضلة · E أرشيف · Del حذف · / بحث
      </div>
    </aside>
  );
}
