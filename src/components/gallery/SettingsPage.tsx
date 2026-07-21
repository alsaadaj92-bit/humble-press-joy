import { useEffect, useState } from "react";
import {
  UserRound,
  RefreshCw,
  Sparkles,
  Cloud,
  Lock,
  ShieldCheck,
  BellRing,
  Database,
  Info,
  Trash2,
  ChevronLeft,
  Wifi,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { IdentityCard } from "./IdentityCard";
import { EncryptionPanel } from "./EncryptionPanel";
import { FaceSettingsPanel } from "./FaceSettingsPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { BackupPanel } from "./BackupPanel";
import { useSyncSettings } from "@/hooks/useSyncEngine";
import { useProviders } from "@/hooks/useProviders";
import { useLockedFolder } from "@/hooks/useLockedFolder";
import { setSyncSettings } from "@/lib/syncEngine";
import type { SyncSettings } from "@/lib/photoDb";
import {
  hasLockedPin,
  setLockedPin,
  unlockWith,
  lockNow,
  resetLockedFolder,
} from "@/lib/lockedFolder";
import {
  getConsent,
  setConsent,
  getTasks,
  setTasks,
  DEFAULT_TASKS,
  type AutoPipelineTasks,
  type ConsentState,
} from "@/lib/autoPipeline";
import {
  notificationsPermission,
  notificationsSupported,
  requestNotificationPermission,
} from "@/lib/notifications";
import { photoDb } from "@/lib/photoDb";
import { APP_VERSION, checkForUpdate, launchApkInstall, type UpdateInfo } from "@/lib/ota";
import { cn } from "@/lib/utils";


type CompressPreset = "original" | "high" | "balanced" | "small";
const PRESETS: Record<Exclude<CompressPreset, "original">, Partial<SyncSettings>> = {
  high: { compressEnabled: true, compressFormat: "webp", compressQuality: 0.9, compressMaxDim: 3840, compressSkipUnderKb: 300 },
  balanced: { compressEnabled: true, compressFormat: "webp", compressQuality: 0.82, compressMaxDim: 2560, compressSkipUnderKb: 300 },
  small: { compressEnabled: true, compressFormat: "webp", compressQuality: 0.65, compressMaxDim: 1600, compressSkipUnderKb: 150 },
};
function currentPreset(s: SyncSettings): CompressPreset | "custom" {
  if (!s.compressEnabled) return "original";
  for (const [name, p] of Object.entries(PRESETS)) {
    if (
      s.compressFormat === p.compressFormat &&
      Math.abs(s.compressQuality - (p.compressQuality as number)) < 0.01 &&
      s.compressMaxDim === p.compressMaxDim
    ) {
      return name as CompressPreset;
    }
  }
  return "custom";
}

interface Props {
  onNavigate: (section: string) => void;
}

export function SettingsPage({ onNavigate }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-2 pb-16">
      <header className="px-1 pb-4 pt-2">
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          كل ما يخص حسابك، المزامنة، الخصوصية، والنسخ الاحتياطي — في مكان واحد.
        </p>
      </header>

      <Group title="الحساب والهوية" icon={UserRound}>
        <IdentityCard />
      </Group>

      <Group title="النسخ الاحتياطي والمزامنة" icon={RefreshCw}>
        <SyncQuickSection onNavigate={onNavigate} />
      </Group>

      <Group title="جودة الرفع" icon={Sparkles}>
        <CompressSection />
      </Group>

      <Group title="مزوّدو التخزين" icon={Cloud}>
        <ProvidersSection onNavigate={onNavigate} />
      </Group>

      <Group title="المجلد المؤمَّن" icon={Lock}>
        <LockedFolderSection onNavigate={onNavigate} />
      </Group>

      <Group title="التشفير من طرف إلى طرف" icon={ShieldCheck}>
        <EncryptionPanel />
      </Group>

      <Group title="الذكاء التلقائي المحلي" icon={Sparkles}>
        <AutoPipelineSection />
      </Group>

      <Group title="التعرّف على الوجوه" icon={UserRound}>
        <FaceSettingsPanel />
      </Group>

      <Group title="الإشعارات" icon={BellRing}>
        <NotificationsSection />
      </Group>

      <Group title="نسخة احتياطية للميتاداتا" icon={Database}>
        <BackupPanel />
      </Group>

      <Group title="الخصوصية والبيانات" icon={ShieldCheck}>
        <PrivacySection />
      </Group>

      <Group title="تحديثات التطبيق (OTA)" icon={Zap}>
        <OtaSection />
      </Group>

      <Group title="حول التطبيق" icon={Info}>
        <AboutSection />
      </Group>

    </div>
  );
}

// -- helpers ---------------------------------------------------------------
function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/60 py-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  title,
  desc,
  right,
  onClick,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-start",
        onClick && "transition hover:bg-secondary/50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{right ?? (onClick && <ChevronLeft className="h-4 w-4 text-muted-foreground" />)}</div>
    </Comp>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        checked ? "bg-primary" : "bg-secondary",
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition",
          checked ? "right-0.5" : "right-5",
        )}
      />
    </button>
  );
}

// -- sections --------------------------------------------------------------

function SyncQuickSection({ onNavigate }: { onNavigate: (s: string) => void }) {
  const s = useSyncSettings();
  const modeLabel = { manual: "يدوي", "auto-on-import": "عند الاستيراد", "auto-interval": `كل ${s.intervalMinutes} د` }[s.mode];
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title="مركز المزامنة"
        desc={`الوضع: ${modeLabel} · ${s.paused ? "متوقّف مؤقتاً" : "نشط"}`}
        onClick={() => onNavigate("sync")}
      />
      <div className="mx-3 h-px bg-border/60" />
      <Row
        title="الرفع على Wi-Fi فقط"
        desc="لا يستخدم بيانات الجوّال أثناء المزامنة."
        right={<Toggle checked={s.wifiOnly} onChange={(v) => setSyncSettings({ wifiOnly: v })} />}
      />
      <div className="mx-3 h-px bg-border/60" />
      <Row
        title="إيقاف المزامنة مؤقتاً"
        desc="أوقف جميع عمليات الرفع دون تفريغ الطابور."
        right={<Toggle checked={s.paused} onChange={(v) => setSyncSettings({ paused: v })} />}
      />
      <div className="mx-3 h-px bg-border/60" />
      <Row
        title="الحد الأقصى لحجم الملف"
        desc={`${s.maxFileMb} ميغابايت`}
        right={
          <input
            type="number"
            min={1}
            max={2000}
            value={s.maxFileMb}
            onChange={(e) => setSyncSettings({ maxFileMb: Math.max(1, Number(e.target.value) || 200) })}
            className="w-20 rounded-lg border border-input bg-secondary/60 px-2 py-1 text-center text-sm"
            dir="ltr"
          />
        }
      />
    </div>
  );
}

function CompressSection() {
  const s = useSyncSettings();
  const cur = currentPreset(s);
  const items: { value: CompressPreset; title: string; desc: string }[] = [
    { value: "original", title: "الملف الأصلي", desc: "لا ضغط. أعلى جودة، أكبر حجم." },
    { value: "high", title: "جودة عالية", desc: "WebP 90% · حتى 3840px." },
    { value: "balanced", title: "متوازن (موصى به)", desc: "WebP 82% · حتى 2560px." },
    { value: "small", title: "حجم صغير", desc: "WebP 65% · حتى 1600px." },
  ];
  const apply = (v: CompressPreset) =>
    v === "original" ? setSyncSettings({ compressEnabled: false }) : setSyncSettings(PRESETS[v]);
  return (
    <div className="rounded-2xl border border-border bg-card p-2">
      {items.map((it, i) => (
        <button
          key={it.value}
          onClick={() => apply(it.value)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-start transition",
            cur === it.value ? "bg-primary/10" : "hover:bg-secondary/50",
            i > 0 && "border-t border-border/40",
          )}
        >
          <div>
            <p className="text-sm font-medium">{it.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
          </div>
          <span
            className={cn(
              "h-4 w-4 rounded-full border-2",
              cur === it.value ? "border-primary bg-primary" : "border-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ProvidersSection({ onNavigate }: { onNavigate: (s: string) => void }) {
  const { active, providers } = useProviders();
  const activeLabel = active === "telegram" ? "تيليجرام" : active === "localServer" ? "الخادم المحلي" : "لا يوجد";
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title="المزوّد النشط"
        desc={`${activeLabel} · ${providers.size} مزوّد مُهيّأ`}
        onClick={() => onNavigate("providers")}
      />
    </div>
  );
}

function LockedFolderSection({ onNavigate }: { onNavigate: (s: string) => void }) {
  const unlocked = useLockedFolder();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  useEffect(() => {
    hasLockedPin().then(setHasPin);
  }, [unlocked]);

  if (!hasPin) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          اضبط رمز PIN لإخفاء الصور الحساسة. الرمز يُخزَّن مُجَزَّأً محلياً على جهازك ولا يغادر أبداً.
        </p>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN (٤ أرقام أو أكثر)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="input-field"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="أعد الإدخال"
          value={pin2}
          onChange={(e) => setPin2(e.target.value)}
          className="input-field"
        />
        <button
          onClick={async () => {
            if (pin.length < 4) return toast.error("الرمز قصير جداً");
            if (pin !== pin2) return toast.error("الرمزان غير متطابقين");
            await setLockedPin(pin);
            await unlockWith(pin);
            setHasPin(true);
            setPin("");
            setPin2("");
            toast.success("تم إعداد المجلد المؤمَّن");
          }}
          className="btn-primary w-full justify-center"
        >
          حفظ الرمز
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title={unlocked ? "المجلد مفتوح حالياً" : "المجلد مقفل"}
        desc={unlocked ? "يمكنك عرض العناصر المؤمَّنة من صفحة المجلد." : "أدخل الرمز من صفحة المجلد لفتحه."}
        onClick={() => onNavigate("locked")}
      />
      <div className="mx-3 h-px bg-border/60" />
      {unlocked && (
        <>
          <Row
            title="قفل الآن"
            desc="إنهاء الجلسة الحالية وإخفاء المحتوى فوراً."
            onClick={() => {
              lockNow();
              toast.success("أُقفل");
            }}
          />
          <div className="mx-3 h-px bg-border/60" />
        </>
      )}
      <Row
        title="إعادة ضبط المجلد المؤمَّن"
        desc="يمسح الرمز ويفكّ قفل جميع العناصر."
        onClick={async () => {
          if (!confirm("سيتم مسح الرمز وفك قفل كل الصور. متابعة؟")) return;
          await resetLockedFolder();
          setHasPin(false);
          toast.success("تمت إعادة الضبط");
        }}
      />
    </div>
  );
}

function AutoPipelineSection() {
  const [consent, setC] = useState<ConsentState>("unset");
  const [tasks, setT] = useState<AutoPipelineTasks>(DEFAULT_TASKS);
  useEffect(() => {
    getConsent().then(setC);
    getTasks().then(setT);
  }, []);
  const enabled = consent === "granted";
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title="تفعيل المعالجة التلقائية"
        desc="بعد كل رفع، يعمل OCR / CLIP / كشف الوجوه داخل جهازك — بدون أي إرسال."
        right={
          <Toggle
            checked={enabled}
            onChange={async (v) => {
              await setConsent(v ? "granted" : "denied");
              setC(v ? "granted" : "denied");
            }}
          />
        }
      />
      {enabled && (
        <>
          <div className="mx-3 h-px bg-border/60" />
          <Row
            title="استخراج النصوص (OCR)"
            desc="عربي وإنجليزي، محلياً بواسطة Tesseract."
            right={
              <Toggle
                checked={tasks.ocr}
                onChange={async (v) => setT(await setTasks({ ocr: v }))}
              />
            }
          />
          <div className="mx-3 h-px bg-border/60" />
          <Row
            title="الفهرسة الدلالية (CLIP)"
            desc="للبحث بالوصف الطبيعي داخل صورك."
            right={
              <Toggle
                checked={tasks.embed}
                onChange={async (v) => setT(await setTasks({ embed: v }))}
              />
            }
          />
          <div className="mx-3 h-px bg-border/60" />
          <Row
            title="كشف الوجوه وتجميع الأشخاص"
            right={
              <Toggle
                checked={tasks.faces}
                onChange={async (v) => setT(await setTasks({ faces: v }))}
              />
            }
          />
        </>
      )}
    </div>
  );
}

function NotificationsSection() {
  const [perm, setPerm] = useState<NotificationPermission>("default");
  useEffect(() => {
    if (notificationsSupported()) setPerm(notificationsPermission());
  }, []);
  if (!notificationsSupported()) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        متصفحك لا يدعم الإشعارات.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title="إشعارات المزامنة"
        desc={
          perm === "granted"
            ? "مفعّلة — ستُنبَّه محلياً عند اكتمال أو فشل الرفع."
            : perm === "denied"
              ? "مرفوضة — فعّلها من إعدادات المتصفح."
              : "لم تُمنح بعد."
        }
        right={
          perm === "granted" ? (
            <span className="text-xs font-medium text-primary">مفعّل ✓</span>
          ) : (
            <button
              onClick={async () => {
                const p = await requestNotificationPermission();
                setPerm(p);
                if (p === "granted") toast.success("تم تفعيل الإشعارات");
                else toast.error("لم يتم منح الصلاحية");
              }}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              تفعيل
            </button>
          )
        }
      />
    </div>
  );
}

function PrivacySection() {
  const clearAll = async () => {
    if (!confirm("سيتم مسح كل الميتاداتا محلياً (الحالات، الألبومات، مراجع الأصول، الطوابير). الملفات على المزوّد لن تُمسّ. متابعة؟")) return;
    await Promise.all([
      photoDb.assets.clear(),
      photoDb.states.clear(),
      photoDb.albums.clear(),
      photoDb.albumMembers.clear(),
      photoDb.syncJobs.clear(),
      photoDb.topicRules.clear(),
      photoDb.ocr.clear(),
      photoDb.embeddings.clear(),
      photoDb.faces.clear(),
      photoDb.persons.clear(),
    ].map((p) => p.catch(() => null)));
    toast.success("تم مسح الميتاداتا المحلية");
    setTimeout(() => window.location.reload(), 800);
  };
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row
        title="سياسة Zero-Cloud"
        desc="لا تُرسل صورك أو ميتاداتاها إلى أي خادم من طرفنا. المزوّد الوحيد الذي يستقبل صورك هو الذي تختاره أنت."
      />
      <div className="mx-3 h-px bg-border/60" />
      <Row
        title="مسح كل الميتاداتا المحلية"
        desc="يحذف قاعدة البيانات على هذا الجهاز فقط. الصور على تيليجرام/الخادم لا تُحذف."
        onClick={clearAll}
        right={<Trash2 className="h-4 w-4 text-destructive" />}
      />
    </div>
  );
}

function AboutSection() {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <Row title="Localphotos Pro" desc="معرض صور خاص بك — بدون سحابة." />
      <div className="mx-3 h-px bg-border/60" />
      <Row title="الإصدار" right={<span className="text-xs text-muted-foreground" dir="ltr">v{APP_VERSION}</span>} />
      <div className="mx-3 h-px bg-border/60" />
      <Row title="الترخيص" right={<span className="text-xs text-muted-foreground">MIT</span>} />
    </div>
  );
}

function OtaSection() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      setInfo(result);
      if (result.available) toast.success(`تحديث متاح: v${result.latestVersion}`);
      else if (result.latestVersion) toast.message(`أنت على أحدث إصدار (v${result.currentVersion})`);
      else toast.error("تعذّر الوصول إلى GitHub");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">تحديثات التطبيق</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          يبحث تلقائياً عن أحدث إصدار من GitHub Releases ويثبّته مباشرة — بدون أي رابط يدوي.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          الإصدار الحالي: <span dir="ltr" className="text-foreground">v{APP_VERSION}</span>
          {info?.latestVersion && (
            <> · الأحدث: <span dir="ltr" className="text-foreground">v{info.latestVersion}</span></>
          )}
        </div>
        <div className="flex gap-2">
          {info?.apkUrl && info.available && (
            <button
              onClick={() => launchApkInstall(info.apkUrl!)}
              className="btn-primary text-xs"
            >
              تحميل وتثبيت
            </button>
          )}
          <button
            onClick={runCheck}
            disabled={checking}
            className="btn-secondary text-xs"
          >
            {checking ? "جارٍ الفحص..." : "فحص التحديثات"}
          </button>
        </div>
      </div>
      {info?.notes && info.available && (
        <div className="rounded-lg border border-border bg-background/60 p-3 text-xs">
          <p className="mb-1 font-semibold">ما الجديد:</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">{info.notes}</pre>
        </div>
      )}
    </div>
  );
}

