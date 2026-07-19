import { Share2, Users, Link2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Google Photos "Sharing" tab placeholder. The actual data plane doesn't
 * exist yet — this is the visual entry point so users see where shared
 * albums and conversations will live once wired up.
 */
export function SharingPanel() {
  const stub = (label: string) => toast.message(`${label} — قريباً`);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          icon={<Users className="h-5 w-5" />}
          title="ألبوم مشترك جديد"
          desc="اجمع صور مناسبة وشاركها مع الأصدقاء والعائلة"
          onClick={() => stub("ألبوم مشترك")}
        />
        <ActionCard
          icon={<Link2 className="h-5 w-5" />}
          title="رابط مشاركة"
          desc="أنشئ رابطاً مباشراً للألبوم — للعرض فقط"
          onClick={() => stub("روابط المشاركة")}
        />
        <ActionCard
          icon={<Send className="h-5 w-5" />}
          title="إرسال إلى شخص"
          desc="أرسل صوراً محددة إلى شريك أو مجموعة"
          onClick={() => stub("الإرسال المباشر")}
        />
        <ActionCard
          icon={<Share2 className="h-5 w-5" />}
          title="مكتبة الشريك"
          desc="شارك كل مكتبتك مع شخص تثق به"
          onClick={() => stub("مكتبة الشريك")}
        />
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <Share2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="mb-1 text-lg font-semibold">لا توجد محادثات مشاركة بعد</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          الصور المشاركة معك أو التي شاركتها ستظهر هنا. حالياً يمكنك تصدير
          الألبومات كملفات ZIP من صفحة الألبومات — المشاركة الفورية عبر الروابط
          والمحادثات ضمن خطة الإصدارات القادمة.
        </p>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-right transition hover:border-primary/40 hover:bg-accent"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            قريباً
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
