import { useEffect, useState } from "react";
import { Lock, LockOpen, ShieldCheck, KeyRound, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { MockPhoto } from "@/lib/mockPhotos";
import { setPhotoStates, type PhotoState } from "@/lib/photoDb";
import {
  hasLockedPin,
  setLockedPin,
  unlockWith,
  lockNow,
  resetLockedFolder,
} from "@/lib/lockedFolder";
import { useLockedFolder } from "@/hooks/useLockedFolder";
import { PhotoGrid } from "./PhotoGrid";

interface Props {
  photos: MockPhoto[];              // full library (already excludes trashed)
  states: Map<string, PhotoState>;
  onOpen: (index: number) => void;
}

export function LockedFolderPanel({ photos, states, onOpen }: Props) {
  const unlocked = useLockedFolder();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    hasLockedPin().then(setHasPin);
  }, [unlocked]);

  const locked = photos.filter((p) => states.get(p.id)?.locked);

  if (!hasPin) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">إعداد المجلد المؤمَّن</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          الصور داخل هذا المجلد لن تظهر في أي قسم آخر، ولن تدخل نتائج البحث أو الذكريات.
          الرمز يُخزَّن مُجَزَّأً محلياً على جهازك — لا يغادر أبداً.
        </p>
        <input
          type="password"
          inputMode="numeric"
          placeholder="اختر رمز PIN (٤ أرقام أو أكثر)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="أعد إدخال الرمز"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={async () => {
            if (pin.length < 4) return toast.error("الرمز قصير جداً");
            if (pin !== confirmPin) return toast.error("الرمزان غير متطابقين");
            await setLockedPin(pin);
            await unlockWith(pin);
            setHasPin(true);
            setPin("");
            setConfirmPin("");
            toast.success("تم إعداد المجلد المؤمَّن");
          }}
          className="w-full rounded-full bg-primary py-2 font-semibold text-primary-foreground"
        >
          حفظ الرمز
        </button>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Lock className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">أدخل رمز الفتح</h3>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const ok = await unlockWith(pin);
              if (ok) { setPin(""); toast.success("مفتوح"); }
              else toast.error("رمز خاطئ");
            }
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-lg tracking-widest"
        />
        <button
          onClick={async () => {
            const ok = await unlockWith(pin);
            if (ok) { setPin(""); toast.success("مفتوح"); }
            else toast.error("رمز خاطئ");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2 font-semibold text-primary-foreground"
        >
          <KeyRound className="h-4 w-4" /> فتح
        </button>
        <button
          onClick={async () => {
            if (!confirm("سيتم مسح الرمز وفك قفل كل الصور. متابعة؟")) return;
            await resetLockedFolder();
            setHasPin(false);
            toast.success("تمت إعادة الضبط");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary py-2 text-xs text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> نسيت الرمز — إعادة ضبط
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-sm">
          <LockOpen className="h-4 w-4 text-primary" />
          مفتوح — {locked.length} عنصر مؤمَّن
        </div>
        <button
          onClick={() => { lockNow(); toast.success("أُقفل"); }}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs"
        >
          <Lock className="h-3.5 w-3.5" /> قفل الآن
        </button>
      </div>
      {locked.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          لا توجد صور هنا. حدّد صوراً من المكتبة واضغط "نقل للمجلد المؤمَّن" من شريط التحديد
          (سيتوفر قريباً كإجراء سريع)، أو استخدم الزر أدناه.
        </p>
      ) : (
        <PhotoGrid
          photos={locked}
          onOpen={(i) => {
            const target = locked[i];
            const g = photos.findIndex((p) => p.id === target.id);
            onOpen(g >= 0 ? g : i);
          }}
          states={states}
          selection={new Set()}
          onToggleSelect={() => {}}
          onFavoriteToggle={() => {}}
        />
      )}
      <details className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">إدارة سريعة</summary>
        <div className="mt-2 space-y-2">
          <p>لنقل الصور إلى المجلد المؤمَّن: افتح صورة من المكتبة العادية ثم استخدم زر القفل — أو أدخل معرفات مفصولة بفواصل هنا:</p>
          <QuickMove />
        </div>
      </details>
    </div>
  );
}

function QuickMove() {
  const [ids, setIds] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={ids}
        onChange={(e) => setIds(e.target.value)}
        placeholder="id1, id2, id3"
        className="flex-1 rounded-md border border-border bg-background px-2 py-1"
      />
      <button
        onClick={async () => {
          const list = ids.split(",").map((s) => s.trim()).filter(Boolean);
          if (!list.length) return;
          await setPhotoStates(list, { locked: true });
          toast.success(`نُقلت ${list.length} إلى المجلد المؤمَّن`);
          setIds("");
        }}
        className="rounded-md bg-primary px-2 py-1 text-primary-foreground"
      >
        نقل
      </button>
    </div>
  );
}
