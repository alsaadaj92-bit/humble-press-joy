import { useMemo, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirmDialog";
import { purgeIds, trashInfo, formatRemaining } from "@/lib/trash";
import type { PhotoState } from "@/lib/photoDb";
import type { MockPhoto } from "@/lib/mockPhotos";

interface Props {
  photos: MockPhoto[];
  states: Map<string, PhotoState>;
  onRestoreAll: (ids: string[]) => void;
}

export function TrashBanner({ photos, states, onRestoreAll }: Props) {
  const [busy, setBusy] = useState(false);
  const now = Date.now();

  const stats = useMemo(() => {
    let soonest = Infinity;
    const ids: string[] = [];
    for (const p of photos) {
      const s = states.get(p.id);
      const info = s ? trashInfo(s, now) : null;
      if (!info) continue;
      ids.push(p.id);
      if (info.msRemaining < soonest) soonest = info.msRemaining;
    }
    const days = soonest === Infinity ? 0 : Math.ceil(soonest / (24 * 60 * 60 * 1000));
    return { ids, soonestDays: days };
  }, [photos, states, now]);

  if (!stats.ids.length) return null;

  const emptyAll = async () => {
    if (!(await confirmDialog({ title: "إفراغ سلة المحذوفات", message: `سيتم حذف ${stats.ids.length} عنصر نهائياً. متابعة؟`, destructive: true, confirmText: "حذف نهائي" }))) return;
    setBusy(true);
    try {
      await purgeIds(stats.ids);
      toast.success("تم إفراغ سلة المحذوفات");
    } catch (err) {
      toast.error("فشل الإفراغ", { description: String((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium">
          العناصر تُحذف تلقائياً بعد 30 يوماً
        </div>
        <div className="text-xs text-muted-foreground">
          الأقرب للحذف: {formatRemaining(stats.soonestDays)} · {stats.ids.length} عنصر في السلة
        </div>
      </div>
      <button
        onClick={() => onRestoreAll(stats.ids)}
        className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
      >
        <RotateCcw className="h-3.5 w-3.5" /> استعادة الكل
      </button>
      <button
        disabled={busy}
        onClick={emptyAll}
        className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> إفراغ نهائي
      </button>
    </div>
  );
}
