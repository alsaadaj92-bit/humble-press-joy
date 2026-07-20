import {
  Send,
  Shield,
  Lock,
  Users,
  Search,
  ScanText,
  Copy,
  Wand2,
  ScanLine,
  Play,
  Save,
  MapPin,
  Route,
  Download,
  Cloud,
  RefreshCw,
} from "lucide-react";

interface Props {
  onNavigate: (section: string) => void;
}

const TOOLS: {
  section: string;
  title: string;
  desc: string;
  icon: typeof Send;
  tag?: string;
}[] = [
  { section: "providers", title: "مزوّدو التخزين", desc: "تيليجرام، خادم محلي، نظام الملفات.", icon: Cloud, tag: "أساسي" },
  { section: "sync", title: "مركز المزامنة", desc: "الحالة، الطابور، وإعادة المحاولة.", icon: RefreshCw, tag: "أساسي" },
  { section: "encryption", title: "خزنة مشفّرة (E2EE)", desc: "تشفير AES-GCM-256 قبل الرفع لتيليجرام.", icon: Shield, tag: "زيرو-كلاود" },
  { section: "locked", title: "المجلد المؤمَّن", desc: "صور مخفية خلف PIN — لا تظهر في المعرض.", icon: Lock },
  { section: "people", title: "تجميع الوجوه", desc: "تعرّف على الأشخاص محلياً بدون سحابة.", icon: Users, tag: "AI محلي" },
  { section: "smart", title: "البحث الذكي (CLIP)", desc: "ابحث في صورك بالوصف الطبيعي.", icon: Search, tag: "AI محلي" },
  { section: "ocr", title: "قراءة النصوص (OCR)", desc: "استخرج نصوص عربي/إنجليزي من الصور.", icon: ScanText, tag: "AI محلي" },
  { section: "duplicates", title: "كشف التكرارات", desc: "تحرير مساحة بحذف النسخ المكررة.", icon: Copy },
  { section: "eraser", title: "الممحاة السحرية", desc: "إزالة عناصر غير مرغوبة محلياً.", icon: Wand2, tag: "AI محلي" },
  { section: "scanner", title: "ماسح المستندات", desc: "تصحيح المنظور + حفظ PDF.", icon: ScanLine },
  { section: "creations", title: "أفلام ومجمّعات", desc: "افلام تلقائية من ذكرياتك.", icon: Play },
  { section: "live-albums", title: "الألبومات الحيّة", desc: "قواعد ذكية تضيف الصور تلقائياً.", icon: Route },
  { section: "backup", title: "نسخ احتياطي كامل", desc: "تصدير/استعادة كل قاعدة البيانات.", icon: Save },
  { section: "places", title: "خريطة الأماكن", desc: "صورك موزّعة على خارطة العالم.", icon: MapPin },
  { section: "settings", title: "OTA — تحديث التطبيق", desc: "فحص وتنزيل أحدث APK من GitHub.", icon: Download },
];

/**
 * Zero-Cloud Advanced Tools — a single hub for everything Localphotos Pro
 * adds beyond a plain Google Photos clone. Rendered inside the Library.
 */
export function AdvancedToolsHub({ onNavigate }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground/80">أدواتنا المتقدمة — Zero-Cloud</h2>
        <span className="text-[10px] text-muted-foreground">كل شيء يعمل داخل جهازك</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((t) => (
          <button
            key={t.section}
            onClick={() => onNavigate(t.section)}
            className="group relative flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 text-right transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary transition group-hover:scale-105">
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{t.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{t.desc}</p>
            </div>
            {t.tag && (
              <span className="absolute left-2 top-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                {t.tag}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
