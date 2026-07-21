import { useEffect, useState } from "react";
import { Lock, Unlock, ShieldCheck, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  isE2EEConfigured,
  isUnlocked,
  setupE2EE,
  unlockE2EE,
  lockE2EE,
  disableE2EE,
  subscribeE2EE,
} from "@/lib/crypto";

export function EncryptionPanel() {
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setConfigured(await isE2EEConfigured());
    setUnlocked(isUnlocked());
  };

  useEffect(() => {
    refresh();
    return subscribeE2EE(refresh);
  }, []);

  const doSetup = async () => {
    if (pass !== pass2) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      await setupE2EE(pass);
      setPass("");
      setPass2("");
      toast.success("تم تفعيل التشفير من طرف إلى طرف");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doUnlock = async () => {
    setBusy(true);
    try {
      await unlockE2EE(pass);
      setPass("");
      toast.success("تم فتح القفل");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDisable = async () => {
    if (
      !(await confirmDialog({
        title: "تعطيل التشفير",
        message:
          "سيتم حذف كلمة السر. الملفات المشفّرة السابقة لن يمكن فكّها بعد ذلك. هل تريد المتابعة؟",
        destructive: true,
      }))
    )
      return;
    await disableE2EE();
    toast.success("تم تعطيل التشفير");
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
          {configured ? (unlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />) : <KeyRound className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold">التشفير من طرف إلى طرف (E2EE)</p>
          <p className="text-xs text-muted-foreground">
            كل ملف يُشفَّر داخل هذا الجهاز قبل الرفع لتيليجرام. حتى تيليجرام لا يستطيع رؤية محتواه.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            اختر كلمة سر قوية (8 أحرف على الأقل). احفظها جيداً — لا يمكن استعادتها.
          </p>
          <Input
            type="password"
            placeholder="كلمة السر"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <Input
            type="password"
            placeholder="أعد إدخال كلمة السر"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
          />
          <Button onClick={doSetup} disabled={busy || pass.length < 8} className="w-full">
            {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-2 h-4 w-4" />}
            تفعيل التشفير
          </Button>
        </div>
      )}

      {configured && !unlocked && (
        <div className="space-y-2">
          <p className="text-xs text-amber-500">التشفير مفعّل لكنه مقفل — أدخل كلمة السر لعرض/رفع الملفات المشفرة.</p>
          <Input
            type="password"
            placeholder="كلمة السر"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doUnlock()}
          />
          <div className="flex gap-2">
            <Button onClick={doUnlock} disabled={busy || !pass} className="flex-1">
              {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Unlock className="ml-2 h-4 w-4" />}
              فتح القفل
            </Button>
            <Button variant="ghost" onClick={doDisable}>
              <ShieldOff className="ml-2 h-4 w-4" />
              تعطيل
            </Button>
          </div>
        </div>
      )}

      {configured && unlocked && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
            التشفير مفتوح — الرفعات الجديدة لتيليجرام ستُشفَّر تلقائياً.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => lockE2EE()} className="flex-1">
              <Lock className="ml-2 h-4 w-4" />
              قفل الجلسة
            </Button>
            <Button variant="ghost" onClick={doDisable}>
              <ShieldOff className="ml-2 h-4 w-4" />
              تعطيل التشفير
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
