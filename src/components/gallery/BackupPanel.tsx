import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, ShieldAlert, BellRing, CalendarClock } from "lucide-react";
import {
  buildBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
} from "@/lib/backup";
import {
  getAutoBackupSettings,
  setAutoBackupSettings,
  type AutoBackupSettings,
} from "@/lib/autoBackup";
import {
  notificationsPermission,
  notificationsSupported,
  requestNotificationPermission,
} from "@/lib/notifications";

export function BackupPanel() {
  const [busy, setBusy] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const doExport = async () => {
    try {
      setBusy(true);
      const b = await buildBackup({ includeSecrets });
      downloadBackup(b);
      toast.success(
        `تم تصدير ${b.counts.assets} عنصر · ${b.counts.albums} ألبوم`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    try {
      setBusy(true);
      const text = await file.text();
      const b = await parseBackup(text);
      const res = await restoreBackup(b, { mode });
      toast.success(
        `تم استعادة ${res.assets} عنصر · ${res.albums} ألبوم · ${res.states} حالة`,
      );
      // reload so live queries pick everything up cleanly
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold">نسخة احتياطية محلية</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          يصدّر كل بيانات المكتبة (الحالات، الألبومات، مراجع الأصول، قواعد
          المواضيع) كملف JSON واحد يحفظ على جهازك فقط — بدون رفعه لأي خادم.
          الصور نفسها لا تُضمَّن؛ تبقى في مزودك الأصلي (تيليجرام/الخادم المحلي).
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-secondary/40 p-4">
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={includeSecrets}
            onChange={(e) => setIncludeSecrets(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="font-medium">تضمين الأسرار</span> (رمز البوت،
            رابط الخادم) — أنصح بتركه مغلقاً إن كنت ستشارك الملف أو تضعه
            في تخزين مشترك.
          </span>
        </label>
        {includeSecrets && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              أي شخص يحصل على الملف سيتمكّن من قراءة/كتابة صورك في تيليجرام.
              خزّنه بأمان.
            </span>
          </div>
        )}
        <button
          onClick={doExport}
          disabled={busy}
          className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {busy ? "..." : "تصدير نسخة احتياطية"}
        </button>
      </div>

      <div className="space-y-3 rounded-xl bg-secondary/40 p-4">
        <p className="text-sm font-medium">استعادة</p>
        <div className="flex gap-2 text-xs">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg bg-card p-2">
            <input
              type="radio"
              name="restore-mode"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
              className="h-4 w-4 accent-primary"
            />
            <span>
              <span className="block font-medium">دمج</span>
              <span className="text-[11px] text-muted-foreground">
                يضيف ويحدّث بدون حذف الموجود
              </span>
            </span>
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg bg-card p-2">
            <input
              type="radio"
              name="restore-mode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              className="h-4 w-4 accent-primary"
            />
            <span>
              <span className="block font-medium">استبدال كامل</span>
              <span className="text-[11px] text-muted-foreground">
                يمسح المكتبة الحالية أولاً
              </span>
            </span>
          </label>
        </div>
        <label className="btn-secondary flex w-full cursor-pointer items-center justify-center gap-2">
          <Upload className="h-4 w-4" />
          {busy ? "..." : "اختر ملف نسخة (.json)"}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) doImport(f);
            }}
          />
        </label>
      </div>
    </section>
  );
}
