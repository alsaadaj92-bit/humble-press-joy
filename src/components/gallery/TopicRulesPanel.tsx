import { useState } from "react";
import { Plus, Trash2, GripVertical, Hash } from "lucide-react";
import { toast } from "sonner";
import { useTopicRules, saveTopicRule, deleteTopicRule } from "@/hooks/useTopicRules";
import { describeRule } from "@/lib/topicRouting";
import type { TopicRule, TopicRuleKind } from "@/lib/photoDb";
import { cn } from "@/lib/utils";

/**
 * Rules that decide which forum-topic each uploaded photo goes into.
 * The user must first turn on Topics in the Telegram group and note the
 * numeric topic id (visible in the URL when opening a topic on Telegram Web).
 */
export function TopicRulesPanel() {
  const rules = useTopicRules();
  const [adding, setAdding] = useState(false);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Hash className="h-4 w-4 text-primary" />
            تنظيم داخل المجموعة (Topics)
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            إذا كانت مجموعتك من نوع <b>Forum</b> (Topics مفعّلة)، حدّد لأي موضوع تُرسَل كل صورة
            بناءً على التاريخ أو الكاميرا أو وجود موقع GPS. القواعد تُطبَّق بالترتيب، وأول قاعدة تتطابق تفوز.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span>قاعدة</span>
        </button>
      </div>

      <div className="rounded-lg bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="text-foreground/80">كيف أجد topic id؟</b> افتح تيليجرام Web، ادخل على الموضوع
        داخل مجموعتك — سيظهر الرابط بشكل <code dir="ltr">.../c/1234567890/12</code> — الرقم الأخير (12)
        هو <code dir="ltr">message_thread_id</code>. عرّف الاسم كما تريد فقط للعرض هنا.
      </div>

      {rules.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          لا توجد قواعد. الصور ستُرفع للمجموعة الرئيسية دون توجيه.
        </p>
      )}

      <ul className="space-y-2">
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.topicName}</p>
              <p className="text-[11px] text-muted-foreground">
                {describeRule(r)} · topic #{r.topicId} · أولوية {r.priority}
              </p>
            </div>
            <button
              onClick={() => {
                void deleteTopicRule(r.id);
                toast.success("حُذفت القاعدة");
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <RuleEditor
          onSave={async (r) => {
            await saveTopicRule(r);
            setAdding(false);
            toast.success("أُضيفت القاعدة");
          }}
          onCancel={() => setAdding(false)}
          nextPriority={(rules[rules.length - 1]?.priority ?? 0) + 10}
        />
      )}
    </section>
  );
}

function RuleEditor({
  onSave,
  onCancel,
  nextPriority,
}: {
  onSave: (r: TopicRule) => void | Promise<void>;
  onCancel: () => void;
  nextPriority: number;
}) {
  const [name, setName] = useState("");
  const [topicId, setTopicId] = useState("");
  const [kind, setKind] = useState<TopicRuleKind>("by-year");
  const [match, setMatch] = useState("");

  const needsMatch = kind !== "default";
  const canSave =
    name.trim().length > 0 &&
    /^\d+$/.test(topicId.trim()) &&
    (!needsMatch || match.trim().length > 0);

  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/[0.04] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">اسم الموضوع (للعرض)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: صور 2024"
            className="input-field"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">topic id (رقمي)</span>
          <input
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            placeholder="12"
            className="input-field"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">القاعدة</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as TopicRuleKind);
              setMatch("");
            }}
            className="input-field"
          >
            <option value="by-year">حسب السنة</option>
            <option value="by-year-month">حسب الشهر</option>
            <option value="by-camera">حسب الكاميرا</option>
            <option value="by-has-gps">حسب وجود GPS</option>
            <option value="default">الافتراضي (يلتقط كل ما تبقى)</option>
          </select>
        </label>
        {needsMatch && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">
              {kind === "by-year" && "السنة (مثال: 2024)"}
              {kind === "by-year-month" && "الشهر (مثال: 2024-06)"}
              {kind === "by-camera" && "اسم/جزء من اسم الكاميرا"}
              {kind === "by-has-gps" && "yes أو no"}
            </span>
            <input
              value={match}
              onChange={(e) => setMatch(e.target.value)}
              className="input-field"
              dir="ltr"
              placeholder={
                kind === "by-year"
                  ? "2024"
                  : kind === "by-year-month"
                  ? "2024-06"
                  : kind === "by-camera"
                  ? "Canon"
                  : "yes"
              }
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary">
          إلغاء
        </button>
        <button
          disabled={!canSave}
          onClick={() =>
            onSave({
              id: `rule-${crypto.randomUUID()}`,
              topicId: Number(topicId.trim()),
              topicName: name.trim(),
              kind,
              match: needsMatch ? match.trim() : undefined,
              priority: nextPriority,
            })
          }
          className={cn("btn-primary", !canSave && "opacity-50")}
        >
          حفظ القاعدة
        </button>
      </div>
    </div>
  );
}
