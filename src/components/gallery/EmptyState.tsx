import { ImageIcon, Heart, Archive, Trash2, Lock, Search, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  section?: string;
  query?: string;
}

const MAP: Record<string, { icon: LucideIcon; title: string; body: string }> = {
  photos: { icon: ImageIcon, title: "لا توجد صور بعد", body: "ابدأ برفع صورك من زر الرفع في الأسفل — كلها تبقى على جهازك." },
  favorites: { icon: Heart, title: "لا مفضلات بعد", body: "اضغط القلب على أي صورة لتظهر هنا." },
  archive: { icon: Archive, title: "الأرشيف فارغ", body: "الصور المؤرشفة تختفي من الشريط الرئيسي لكنها تبقى في مكتبتك." },
  trash: { icon: Trash2, title: "سلة المحذوفات فارغة", body: "العناصر المحذوفة تُمسح تلقائياً بعد 30 يوماً." },
  locked: { icon: Lock, title: "المجلد المؤمَّن فارغ", body: "انقل الصور الحساسة هنا لحمايتها بـ PIN — لا تظهر في أي مكان آخر." },
};

export function EmptyState({ section = "photos", query }: EmptyStateProps) {
  if (query?.trim()) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center animate-fade-in">
        <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <div className="mb-1 text-base font-medium">لا نتائج لـ «{query}»</div>
        <div className="text-sm text-muted-foreground">جرّب كلمة مختلفة، أو استخدم البحث الذكي المحلي.</div>
      </div>
    );
  }
  const cfg = MAP[section] ?? MAP.photos;
  const Icon = cfg.icon;
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center animate-fade-in">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <div className="mb-1 text-base font-medium">{cfg.title}</div>
      <div className="text-sm text-muted-foreground">{cfg.body}</div>
    </div>
  );
}
