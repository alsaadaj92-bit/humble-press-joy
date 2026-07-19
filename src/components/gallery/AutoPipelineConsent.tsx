import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getConsent, setConsent, backfillMissing } from "@/lib/autoPipeline";
import { toast } from "sonner";

/**
 * First-run dialog. Shown once per browser profile — if the user grants
 * consent, the AutoPipeline runs silently for every future upload and we
 * also kick off a backfill for any existing assets.
 */
export function AutoPipelineConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getConsent().then((c) => {
      if (alive && c === "unset") setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const grant = async () => {
    await setConsent("granted");
    setOpen(false);
    toast.success("تم تفعيل المعالجة التلقائية");
    const n = await backfillMissing(100);
    if (n > 0) toast.message(`جاري معالجة ${n} صورة موجودة في الخلفية`);
  };

  const deny = async () => {
    await setConsent("denied");
    setOpen(false);
    toast.message("يمكنك تفعيلها لاحقاً من الإعدادات");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            تفعيل الذكاء التلقائي المحلي
          </DialogTitle>
          <DialogDescription className="pt-2 text-right leading-relaxed">
            بعد كل رفع، سنقوم تلقائياً وفي جهازك فقط بـ:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
            <span>استخراج النصوص من الصور (OCR — عربي + إنجليزي)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
            <span>فهرسة دلالية للبحث بالوصف (CLIP)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
            <span>كشف الوجوه وتجميع الأشخاص</span>
          </li>
        </ul>

        <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            كل شيء يعمل في المتصفح
          </div>
          لا تُرسل صورك أو نتائج المعالجة إلى أي خادم خارجي. الموافقة تُطلب
          هذه المرة فقط — يمكنك إيقافها من الإعدادات في أي وقت.
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={grant} className="flex-1">
            <Sparkles className="ml-2 h-4 w-4" /> تفعيل
          </Button>
          <Button variant="outline" onClick={deny}>
            <X className="ml-2 h-4 w-4" /> ليس الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
