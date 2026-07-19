import {
  LibraryBig,
  Heart,
  Star,
  Copy,
  Lock,
  Archive,
  Trash2,
  Cloud,
  RefreshCw,
  Play,
  ScanLine,
  Users,
  MapPin,
  Video,
  ScanText,
  Sparkles,
} from "lucide-react";

interface Props {
  onNavigate: (section: string) => void;
}

const CARDS: {
  section: string;
  title: string;
  desc: string;
  icon: typeof Heart;
  tone?: "primary" | "muted";
}[] = [
  { section: "albums", title: "الألبومات", desc: "ألبومات يدوية وتلقائية حسب السنة والشهر", icon: LibraryBig, tone: "primary" },
  { section: "favorites", title: "المفضلة", desc: "كل ما ميّزته بقلب", icon: Heart },
  { section: "creations", title: "الأفلام والمجمّعات", desc: "أفلام وسلايدات محلية بالكامل", icon: Play },
  { section: "scanner", title: "ماسح المستندات", desc: "تصحيح المنظور وحفظ PDF محلي", icon: ScanLine },
  { section: "duplicates", title: "التكرارات", desc: "كشف الصور المكررة محلياً", icon: Copy },
  { section: "people", title: "الأشخاص والحيوانات", desc: "تجميع الوجوه محلياً بدون سحابة", icon: Users },
  { section: "places", title: "الأماكن", desc: "خريطة بناءً على EXIF المحلي", icon: MapPin },
  { section: "videos", title: "الفيديوهات", desc: "كل مقاطع الفيديو في مكتبتك", icon: Video },
  { section: "ocr", title: "قراءة النصوص", desc: "استخرج النصوص من الصور محلياً", icon: ScanText },
  { section: "memories", title: "الذكريات", desc: "لحظات مختارة لك", icon: Sparkles },
  { section: "locked", title: "المجلد المؤمَّن", desc: "محمي بـ PIN — لا يظهر في أي مكان آخر", icon: Lock },
  { section: "archive", title: "الأرشيف", desc: "صور خارج التدفق الرئيسي", icon: Archive },
  { section: "trash", title: "سلة المحذوفات", desc: "تُفرَّغ تلقائياً بعد 30 يوماً", icon: Trash2 },
  { section: "starred", title: "المميّزة بنجمة", desc: "قريباً", icon: Star },
];

const UTILS: { section: string; title: string; desc: string; icon: typeof Cloud }[] = [
  { section: "providers", title: "مزودو التخزين", desc: "تيليجرام، الخادم المحلي، أو نظام الملفات", icon: Cloud },
  { section: "sync", title: "مركز المزامنة", desc: "الحالة، القوائم، وإعادة المحاولة", icon: RefreshCw },
];

/**
 * Google-Photos-style Library hub: one page that surfaces every corner of the
 * app (Albums, Favorites, Archive, Trash, Locked, Utilities…) as tap-cards.
 * Pure navigation UI — no data mutations happen here.
 */
export function LibraryHub({ onNavigate }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-foreground/80">
          المجموعات
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <HubCard key={c.section} {...c} onClick={() => onNavigate(c.section)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-foreground/80">
          أدوات
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {UTILS.map((c) => (
            <HubCard key={c.section} {...c} onClick={() => onNavigate(c.section)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HubCard({
  title,
  desc,
  icon: Icon,
  onClick,
  tone,
}: {
  title: string;
  desc: string;
  icon: typeof Heart;
  onClick: () => void;
  tone?: "primary" | "muted";
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:shadow-lg"
    >
      <div
        className={
          "grid h-11 w-11 shrink-0 place-items-center rounded-full transition group-hover:scale-105 " +
          (tone === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-primary/15 text-primary")
        }
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
