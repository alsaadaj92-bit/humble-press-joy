import { ImageIcon, Heart, Archive, Trash2, Lock, Search, Images, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";
import { setConsent } from "@/lib/autoPipeline";

interface EmptyStateProps {
  section?: string;
  query?: string;
}

const MAP: Record<string, { icon: LucideIcon; title: string; body: string }> = {
  photos: { icon: ImageIcon, title: "لا توجد صور بعد", body: "استورد صور معرض هاتفك — كلها تبقى على جهازك." },
  favorites: { icon: Heart, title: "لا مفضلات بعد", body: "اضغط القلب على أي صورة لتظهر هنا." },
  archive: { icon: Archive, title: "الأرشيف فارغ", body: "الصور المؤرشفة تختفي من الشريط الرئيسي لكنها تبقى في مكتبتك." },
  trash: { icon: Trash2, title: "سلة المحذوفات فارغة", body: "العناصر المحذوفة تُمسح تلقائياً بعد 30 يوماً." },
  locked: { icon: Lock, title: "المجلد المؤمَّن فارغ", body: "انقل الصور الحساسة هنا لحمايتها بـ PIN — لا تظهر في أي مكان آخر." },
};

export function EmptyState({ section = "photos", query }: EmptyStateProps) {
  const [busy, setBusy] = useState(false);

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
  const canImport = section === "photos" && canScanDeviceGallery();

  const importAll = async () => {
    setBusy(true);
    try {
      // Auto-enable AI pipeline silently so faces/OCR/search run in the background.
      await setConsent("granted").catch(() => undefined);
      const n = await scanDeviceGallery();
      if (n === 0) toast.info("لم يتم استيراد صور — تأكد من منح إذن الوصول للمعرض");
      else toast.success(`تم استيراد ${n} عنصراً`);
    } catch (e) {
      toast.error("فشل الاستيراد: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center animate-fade-in">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <div className="mb-1 text-base font-medium">{cfg.title}</div>
      <div className="text-sm text-muted-foreground">{cfg.body}</div>
      {canImport && (
        <button
          disabled={busy}
          onClick={importAll}
          className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          <Images className="h-4 w-4" />
          {busy ? "جارٍ الاستيراد…" : "استيراد كل صور المعرض"}
        </button>
      )}
    </div>
  );
}
