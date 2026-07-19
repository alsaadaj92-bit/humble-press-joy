import { useMemo, useState } from "react";
import { Copy, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import type { MockPhoto } from "@/lib/mockPhotos";
import { picsumThumb } from "@/lib/mockPhotos";
import type { PhotoState } from "@/lib/photoDb";
import { findDuplicates, type DuplicateGroup } from "@/lib/duplicates";
import { setPhotoStates } from "@/lib/photoDb";

const REASON_LABEL: Record<DuplicateGroup["reason"], string> = {
  size: "نفس الحجم بالبايت",
  "exif-time": "التقطت في نفس اللحظة",
  name: "اسم الملف متطابق",
};

function thumb(p: MockPhoto) {
  return p.thumbSrc || picsumThumb(p.seed, 300);
}

export function DuplicatesPanel({
  photos,
  states,
}: {
  photos: MockPhoto[];
  states: Map<string, PhotoState>;
}) {
  const groups = useMemo(() => findDuplicates(photos, states), [photos, states]);
  const [keep, setKeep] = useState<Map<string, string>>(new Map()); // groupId -> photoId to keep

  if (!groups.length) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <Copy className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">لا توجد صور مكررة</h2>
        <p className="text-sm text-muted-foreground">
          نبحث محلياً في مكتبتك عن التكرارات باستخدام الحجم وبيانات EXIF واسم الملف — دون إرسال أي شيء إلى الخارج.
        </p>
      </div>
    );
  }

  const totalWasted = groups.reduce((s, g) => s + (g.photos.length - 1), 0);

  const setKept = (groupId: string, photoId: string) => {
    setKeep((prev) => {
      const next = new Map(prev);
      next.set(groupId, photoId);
      return next;
    });
  };

  const deleteExtras = (g: DuplicateGroup) => {
    const kept = keep.get(g.id) ?? g.photos[0].id;
    const toDelete = g.photos.filter((p) => p.id !== kept).map((p) => p.id);
    if (!toDelete.length) return;
    setPhotoStates(toDelete, { trashedAt: Date.now() });
    toast.success(`نُقلت ${toDelete.length} نسخة مكررة إلى سلة المحذوفات`);
  };

  const deleteAllExtras = () => {
    const all: string[] = [];
    for (const g of groups) {
      const kept = keep.get(g.id) ?? g.photos[0].id;
      for (const p of g.photos) if (p.id !== kept) all.push(p.id);
    }
    if (!all.length) return;
    setPhotoStates(all, { trashedAt: Date.now() });
    toast.success(`نُقلت ${all.length} نسخة مكررة إلى سلة المحذوفات`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4">
        <div>
          <p className="text-sm font-semibold">
            {groups.length} مجموعة تكرارات · يمكن توفير {totalWasted} صورة
          </p>
          <p className="text-xs text-muted-foreground">
            في كل مجموعة اختر النسخة التي تريد الاحتفاظ بها، وسينتقل الباقي إلى سلة المحذوفات.
          </p>
        </div>
        <button
          onClick={deleteAllExtras}
          className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
        >
          <Trash2 className="h-4 w-4" />
          حذف كل التكرارات
        </button>
      </div>

      {groups.map((g) => {
        const kept = keep.get(g.id) ?? g.photos[0].id;
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{REASON_LABEL[g.reason]}</p>
                <p className="text-[11px] text-muted-foreground">
                  {g.photos.length} نسخ · مفتاح: <code className="ltr:font-mono">{g.key}</code>
                </p>
              </div>
              <button
                onClick={() => deleteExtras(g)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف الباقي
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {g.photos.map((p) => {
                const isKept = p.id === kept;
                return (
                  <button
                    key={p.id}
                    onClick={() => setKept(g.id, p.id)}
                    className={`group relative aspect-square overflow-hidden rounded-xl border transition ${
                      isKept ? "border-primary ring-2 ring-primary/30" : "border-border opacity-70 hover:opacity-100"
                    }`}
                    aria-label={isKept ? "المحتفظ بها" : "اختر للاحتفاظ"}
                  >
                    <img src={thumb(p)} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    {isKept && (
                      <div className="absolute inset-x-0 top-0 flex items-center gap-1 bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                        <Check className="h-3 w-3" /> الاحتفاظ
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">
                      {p.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
