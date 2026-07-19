import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  HardDrive,
  Loader2,
  Send,
  ServerCog,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { photoDb, type ProviderConfig, type ProviderKind } from "@/lib/photoDb";
import { useProviders } from "@/hooks/useProviders";
import { saveProviderConfig, setActiveProvider } from "@/lib/providers";
import {
  telegramGetMe,
  telegramGetUpdates,
  telegramTest,
  type TgBotInfo,
} from "@/lib/providers/telegram";
import { localServerTest } from "@/lib/providers/localServer";
import { cn } from "@/lib/utils";

const TABS: { kind: ProviderKind; label: string; icon: typeof Cloud }[] = [
  { kind: "telegram", label: "تيليجرام", icon: Send },
  { kind: "localServer", label: "الخادم المحلي", icon: ServerCog },
  { kind: "fileSystem", label: "مجلد على الجهاز", icon: HardDrive },
];

export function ProvidersPanel() {
  const { providers, active } = useProviders();
  const [tab, setTab] = useState<ProviderKind>("telegram");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">مزودو التخزين</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              اختر المكان الذي تُرفع إليه صورك. لا شيء يُخزَّن في أي سحابة تخص Lovable —
              الاعتمادات تبقى في متصفحك (IndexedDB) والاتصال يتم مباشرة مع الخدمة التي
              تختارها.
            </p>
          </div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary whitespace-nowrap">
            {active ? `النشط: ${labelOf(active)}` : "لا يوجد نشط"}
          </span>
        </div>
      </div>

      <div className="flex gap-2 rounded-full bg-secondary p-1 text-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const cfg = providers.get(t.kind);
          return (
            <button
              key={t.kind}
              onClick={() => setTab(t.kind)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 transition",
                tab === t.kind
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {cfg?.configured && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "telegram" && (
        <TelegramForm cfg={providers.get("telegram")} active={active === "telegram"} />
      )}
      {tab === "localServer" && (
        <LocalServerForm cfg={providers.get("localServer")} active={active === "localServer"} />
      )}
      {tab === "fileSystem" && <FileSystemStub />}
    </div>
  );
}

function labelOf(k: ProviderKind) {
  return TABS.find((t) => t.kind === k)?.label ?? k;
}

// ---------------- Telegram --------------------------------------------------
function TelegramForm({
  cfg,
  active,
}: {
  cfg: ProviderConfig | undefined;
  active: boolean;
}) {
  const [botToken, setBotToken] = useState(cfg?.botToken ?? "");
  const [chatId, setChatId] = useState(cfg?.chatId ?? "");
  const [testing, setTesting] = useState(false);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  useEffect(() => {
    setBotToken(cfg?.botToken ?? "");
    setChatId(cfg?.chatId ?? "");
  }, [cfg]);

  const canTest = botToken.trim().length > 20 && chatId.trim().length > 0;

  const doTest = async () => {
    setTesting(true);
    setTestInfo(null);
    try {
      const chat = await telegramTest(botToken.trim(), chatId.trim());
      setTestInfo(`الاتصال ناجح — ${chat.title ?? chat.username ?? chat.type} (#${chat.id})`);
      toast.success("Telegram متصل");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("فشل الاتصال بتيليجرام", { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const doSave = async (setActive: boolean) => {
    await saveProviderConfig({
      kind: "telegram",
      configured: canTest,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    });
    if (setActive) await setActiveProvider("telegram");
    toast.success(setActive ? "تم الحفظ وتفعيل تيليجرام" : "تم حفظ الإعدادات");
  };

  return (
    <Card>
      <h3 className="text-base font-semibold">إعدادات بوت تيليجرام</h3>
      <p className="text-xs text-muted-foreground">
        أنشئ بوتاً من @BotFather، ثم أرسل له رسالة من محادثة "Saved Messages" أو مجموعة
        خاصة لتحصل على chat_id (يمكنك استخدام @userinfobot).
      </p>

      <Field label="Bot Token" hint="نمط الشكل: 123456789:AAA...">
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:AA..."
          className="input-field"
          autoComplete="off"
        />
      </Field>

      <Field label="Chat ID" hint="رقم موجب أو سالب (للمجموعات).">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="مثال: 123456789"
          className="input-field"
          inputMode="numeric"
        />
      </Field>

      {testInfo && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          {testInfo}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={doTest}
          disabled={!canTest || testing}
          className="btn-secondary"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          <span>اختبار الاتصال</span>
        </button>
        <button onClick={() => doSave(false)} disabled={!canTest} className="btn-secondary">
          حفظ فقط
        </button>
        <button onClick={() => doSave(true)} disabled={!canTest} className="btn-primary">
          حفظ وجعله المزود النشط
        </button>
        {active && (
          <span className="ml-auto flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4" /> نشط الآن
          </span>
        )}
      </div>
    </Card>
  );
}

// ---------------- Local Server ---------------------------------------------
function LocalServerForm({
  cfg,
  active,
}: {
  cfg: ProviderConfig | undefined;
  active: boolean;
}) {
  const [baseUrl, setBaseUrl] = useState(cfg?.baseUrl ?? "http://localhost:3000");
  const [testing, setTesting] = useState(false);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cfg?.baseUrl) setBaseUrl(cfg.baseUrl);
  }, [cfg]);

  const canTest = /^https?:\/\/.+/.test(baseUrl.trim());

  const doTest = async () => {
    setTesting(true);
    setTestInfo(null);
    try {
      const info = await localServerTest(baseUrl.trim());
      setTestInfo(`الخادم متاح ✓ ${JSON.stringify(info).slice(0, 120)}`);
      toast.success("الخادم المحلي متصل");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("تعذّر الوصول للخادم", { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const doSave = async (setActive: boolean) => {
    await saveProviderConfig({
      kind: "localServer",
      configured: canTest,
      baseUrl: baseUrl.trim(),
    });
    if (setActive) await setActiveProvider("localServer");
    toast.success(setActive ? "تم الحفظ وتفعيل الخادم المحلي" : "تم حفظ الإعدادات");
  };

  return (
    <Card>
      <h3 className="text-base font-semibold">إعدادات الخادم المحلي</h3>
      <p className="text-xs text-muted-foreground">
        ستحصل على كود خادم Node.js جاهز في المرحلة التالية. أدخل هنا عنوانه على شبكتك
        المحلية (مثل <code>http://192.168.1.100:3000</code>). الاتصال داخل شبكتك فقط.
      </p>

      <Field label="عنوان الخادم" hint="بدون شرطة مائلة نهائية">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://192.168.1.100:3000"
          className="input-field"
          dir="ltr"
        />
      </Field>

      {testInfo && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary" dir="ltr">
          {testInfo}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={doTest}
          disabled={!canTest || testing}
          className="btn-secondary"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          <span>اختبار /health</span>
        </button>
        <button onClick={() => doSave(false)} disabled={!canTest} className="btn-secondary">
          حفظ فقط
        </button>
        <button onClick={() => doSave(true)} disabled={!canTest} className="btn-primary">
          حفظ وجعله المزود النشط
        </button>
        {active && (
          <span className="ml-auto flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4" /> نشط الآن
          </span>
        )}
      </div>
    </Card>
  );
}

// ---------------- File System stub ------------------------------------------
function FileSystemStub() {
  return (
    <Card>
      <h3 className="text-base font-semibold">مجلد على الجهاز (File System Access API)</h3>
      <p className="text-sm text-muted-foreground">
        سيتم تفعيله في خطوة قادمة — يسمح بكتابة الصور مباشرة إلى مجلد محلي تختاره،
        بدون أي خادم على الإطلاق. مدعوم فقط في متصفحات Chromium.
      </p>
    </Card>
  );
}

// ---------------- Small building blocks -------------------------------------
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
