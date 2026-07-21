import { Video, Camera, ScanText, Users, MapPin, Heart, Sparkles, FolderHeart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chip {
  id: string;
  label: string;
  icon: typeof Video;
}

const CHIPS: Chip[] = [
  { id: "memories", label: "ذكريات", icon: Sparkles },
  { id: "people", label: "أشخاص", icon: Users },
  { id: "places", label: "أماكن", icon: MapPin },
  { id: "favorites", label: "المفضلة", icon: Heart },
  { id: "videos", label: "فيديوهات", icon: Video },
  { id: "selfies", label: "سيلفي", icon: Camera },
  { id: "screenshots", label: "لقطات شاشة", icon: ScanText },
  { id: "albums", label: "ألبومات", icon: FolderHeart },
];

interface Props {
  active: string;
  onSelect: (id: string) => void;
}

export function QuickChips({ active, onSelect }: Props) {
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto bg-transparent px-4 py-2.5 md:px-8">
      {CHIPS.map((c) => {
        const Icon = c.icon;
        const isActive = active === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "group flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card/50 text-foreground/80 hover:border-primary/40 hover:bg-card hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", isActive ? "" : "text-muted-foreground group-hover:text-primary")} />
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
