import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { photoDb } from "@/lib/photoDb";
import { getSyncSettings, setSyncSettings } from "@/lib/syncEngine";

export function IdentityCard() {
  const [name, setName] = useState("");
  const [autoTopics, setAutoTopics] = useState(true);

  useEffect(() => {
    const s = liveQuery(() => photoDb.kv.get("uploaderName")).subscribe({
      next: (v) => setName(v?.value ?? ""),
    });
    getSyncSettings().then((s) => setAutoTopics(s.autoCreateTopics));
    return () => s.unsubscribe();
  }, []);

  const saveName = async () => {
    await photoDb.kv.put({ key: "uploaderName", value: name.trim() });
    toast.success("تم حفظ اسمك");
  };

  const toggleAuto = async (v: boolean) => {
    setAutoTopics(v);
    await setSyncSettings({ autoCreateTopics: v });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">اسمي كمُشارِك</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          هذا الاسم يُرفَق كتعليق أعلى كل صورة تُرفع إلى مجموعة تيليجرام. عندما
          يشاركك شخص آخر (زوجتك مثلاً) نفس المجموعة من جهازه، سيكتب اسمه هو في
          إعداداته، فتظهر صورك باسمك وصوره باسمه — دون أي خلط، ومن ثم يمكن
          فلترتها لاحقاً حسب كل شخص.
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: أحمد"
            className="input-field flex-1"
            maxLength={40}
          />
          <button onClick={saveName} className="btn-primary">
            حفظ
          </button>
        </div>
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
          💡 المشاركة الحقيقية بين جهازين ستأتي كتطبيق Android لاحقاً؛ اليوم:
          كل جهاز يستخدم نفس bot token + chat id، والاسم يفصل الرَّفعات بصرياً.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">مواضيع تيليجرام التلقائية</h3>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={autoTopics}
            onChange={(e) => toggleAuto(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm font-medium">
              إنشاء موضوع تلقائياً لكل ألبوم شهر
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              عند رفع أول صورة لشهر جديد، يحاول التطبيق إنشاء موضوع باسم الشهر
              في مجموعتك (إن كانت من نوع Forum والبوت أدمن). في حالة الفشل،
              تُرفع الصور في المحادثة العامة.
            </p>
          </div>
        </label>
      </section>
    </div>
  );
}
