import {
  LibraryBig,
  Heart,
  Trash2,
  Archive,
  Lock,
  Users,
  Sparkles,
  Video,
  ScanText,
  Camera,
  MapPin,
  ScanLine,
  Copy,
  Play,
  Smartphone,
} from "lucide-react";
import { AdvancedToolsHub } from "./AdvancedToolsHub";

interface Props {
  onNavigate: (section: string) => void;
}

// Top pill row — matches Google Photos "Collections" quick actions.
const PILLS = [
  { section: "favorites", title: "المفضلة", icon: Heart },
  { section: "trash", title: "المهملات", icon: Trash2 },
  { section: "screenshots", title: "لقطات الشاشة", icon: ScanText },
  { section: "archive", title: "الأرشيف", icon: Archive },
];

// Big feature tiles (Albums, On this device, People, Moments).
const TILES = [
  { section: "albums", title: "الألبومات", icon: LibraryBig, tone: "primary" as const },
  { section: "device", title: "على هذا الجهاز", icon: Smartphone, tone: "muted" as const },
  { section: "people", title: "الأشخاص", icon: Users, tone: "muted" as const },
  { section: "memories", title: "اللحظات", icon: Sparkles, tone: "primary" as const },
];

// Compact list at the bottom (Screenshots, Videos, Documents, Utilities).
const LIST = [
  { section: "videos", title: "الفيديوهات", icon: Video },
  { section: "scanner", title: "المستندات", icon: ScanLine },
  { section: "places", title: "الأماكن", icon: MapPin },
  { section: "duplicates", title: "التكرارات", icon: Copy },
  { section: "creations", title: "الأفلام والمجمّعات", icon: Play },
  { section: "ocr", title: "قراءة النصوص", icon: ScanText },
  { section: "locked", title: "المجلد المؤمَّن", icon: Lock },
  { section: "selfies", title: "السيلفي", icon: Camera },
];

/** Google Photos-style Library/Collections landing page. */
export function LibraryHub({ onNavigate }: Props) {
  return (
    <div className="space-y-6 pb-6">
      {/* Quick pills */}
      <div className="grid grid-cols-2 gap-3">
        {PILLS.map((p) => (
          <button
            key={p.section}
            onClick={() => onNavigate(p.section)}
            className="flex items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-3 text-right transition hover:border-primary/40 hover:bg-accent"
          >
            <p.icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{p.title}</span>
          </button>
        ))}
      </div>

      {/* Big tiles */}
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <button
            key={t.section}
            onClick={() => onNavigate(t.section)}
            className="group aspect-square overflow-hidden rounded-2xl border border-border bg-card p-4 text-right transition hover:border-primary/40 hover:bg-accent"
          >
            <div className="flex h-full flex-col justify-between">
              <div
                className={
                  "grid h-14 w-14 place-items-center rounded-full transition group-hover:scale-105 " +
                  (t.tone === "primary"
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/15 text-primary")
                }
              >
                <t.icon className="h-7 w-7" />
              </div>
              <p className="mt-3 text-base font-semibold">{t.title}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Compact list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {LIST.map((it, i) => (
          <button
            key={it.section}
            onClick={() => onNavigate(it.section)}
            className={
              "flex w-full items-center gap-4 px-4 py-3.5 text-right transition hover:bg-accent " +
              (i > 0 ? "border-t border-border/60" : "")
            }
          >
            <it.icon className="h-5 w-5 text-primary" />
            <span className="text-sm">{it.title}</span>
          </button>
        ))}
      </div>

      {/* Advanced tools — our Zero-Cloud additions */}
      <AdvancedToolsHub onNavigate={onNavigate} />
    </div>
  );
}
