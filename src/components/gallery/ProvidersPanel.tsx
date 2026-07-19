import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  Send,
  ServerCog,
  Shield,
  Terminal,
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
import { LOCAL_SERVER_CODE, LOCAL_SERVER_PACKAGE_JSON } from "@/lib/serverCode";
import { TopicRulesPanel } from "@/components/gallery/TopicRulesPanel";
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
  const [botInfo, setBotInfo] = useState<TgBotInfo | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [listening, setListening] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInfo, setTestInfo] = useState<string | null>(null);
  const listenAbort = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    setBotToken(cfg?.botToken ?? "");
    setChatId(cfg?.chatId ?? "");
  }, [cfg]);

  const tokenLooksValid = /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(botToken.trim());
  const canSave = tokenLooksValid && chatId.trim().length > 0;

  const verifyToken = async () => {
    setVerifyingToken(true);
    try {
      const info = await telegramGetMe(botToken.trim());
      setBotInfo(info);
      toast.success(`تم التعرف على البوت: @${info.username ?? info.first_name}`);
    } catch (e) {
      setBotInfo(null);
      toast.error("توكن غير صالح", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setVerifyingToken(false);
    }
  };

  // Auto-verify when token changes and looks valid
  useEffect(() => {
    if (!tokenLooksValid) {
      setBotInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await telegramGetMe(botToken.trim());
        if (!cancelled) setBotInfo(info);
      } catch {
        if (!cancelled) setBotInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botToken, tokenLooksValid]);

  // Poll getUpdates to auto-detect chat id after user taps /start in Telegram
  const startListening = async () => {
    if (!tokenLooksValid) {
      toast.error("أدخل توكن صالح أولاً");
      return;
    }
    listenAbort.current = { cancelled: false };
    setListening(true);
    const startedAt = Date.now();
    try {
      while (!listenAbort.current.cancelled && Date.now() - startedAt < 120_000) {
        const updates = await telegramGetUpdates(botToken.trim());
        const withMsg = updates.filter((u) => u.message?.chat?.id);
        if (withMsg.length > 0) {
          const last = withMsg[withMsg.length - 1];
          const id = String(last.message!.chat.id);
          setChatId(id);
          toast.success("تم التقاط الـ Chat ID تلقائياً", {
            description: `#${id} — ${last.message!.chat.first_name ?? last.message!.chat.title ?? last.message!.chat.username ?? "chat"}`,
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!listenAbort.current.cancelled) {
        toast.info("انتهت مهلة الاستماع", {
          description: "اضغط 'الاستماع' مرة أخرى ثم أرسل /start للبوت.",
        });
      }
    } catch (e) {
      toast.error("فشل الاستماع", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setListening(false);
    }
  };

  const stopListening = () => {
    if (listenAbort.current) listenAbort.current.cancelled = true;
    setListening(false);
  };

  useEffect(() => () => stopListening(), []);

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
      configured: canSave,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    });
    if (setActive) await setActiveProvider("telegram");
    toast.success(setActive ? "تم الحفظ وتفعيل تيليجرام" : "تم حفظ الإعدادات");
  };

  const openBotFather = () => {
    // Deep link: opens Telegram app on mobile, web on desktop
    window.open("https://t.me/BotFather", "_blank", "noopener");
  };
  const openMyBot = () => {
    if (!botInfo?.username) return;
    window.open(`https://t.me/${botInfo.username}?start=link`, "_blank", "noopener");
  };
  const openUserInfoBot = () => {
    window.open("https://t.me/userinfobot", "_blank", "noopener");
  };

  const step1Done = tokenLooksValid && !!botInfo;
  const step2Done = chatId.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* STEP 1 — Create bot & paste token */}
      <StepCard
        n={1}
        title="أنشئ بوتاً واحصل على التوكن"
        done={step1Done}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          افتح <b>@BotFather</b> في تيليجرام، أرسل <code className="rounded bg-secondary px-1">/newbot</code>،
          اختر اسماً ثم username ينتهي بـ <code className="rounded bg-secondary px-1">bot</code>.
          سيرد عليك بتوكن مثل <code className="rounded bg-secondary px-1" dir="ltr">123456:AA...</code> — انسخه والصقه هنا.
        </p>

        <button onClick={openBotFather} className="btn-secondary w-full sm:w-auto">
          <ExternalLink className="h-4 w-4" />
          <span>افتح @BotFather في تيليجرام</span>
        </button>

        <Field label="Bot Token">
          <div className="flex gap-2">
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:AA..."
              className="input-field flex-1"
              autoComplete="off"
              dir="ltr"
            />
            <button
              onClick={verifyToken}
              disabled={!tokenLooksValid || verifyingToken}
              className="btn-secondary"
              title="تحقق"
            >
              {verifyingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {botInfo && (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            ✓ البوت جاهز: <b>@{botInfo.username}</b> ({botInfo.first_name})
          </div>
        )}
      </StepCard>

      {/* STEP 2 — Get chat id */}
      <StepCard
        n={2}
        title="اربط محادثتك مع البوت"
        done={step2Done}
        muted={!step1Done}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          افتح البوت الذي أنشأته، اضغط <b>Start</b> أو أرسل أي رسالة له،
          وسيلتقط التطبيق الـ Chat ID تلقائياً.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openMyBot}
            disabled={!botInfo?.username}
            className="btn-primary"
          >
            <ExternalLink className="h-4 w-4" />
            <span>افتح البوت الآن</span>
          </button>
          {!listening ? (
            <button
              onClick={startListening}
              disabled={!tokenLooksValid}
              className="btn-secondary"
            >
              <Zap className="h-4 w-4" />
              <span>ابدأ الاستماع للـ /start</span>
            </button>
          ) : (
            <button onClick={stopListening} className="btn-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>جاري الاستماع… (اضغط للإلغاء)</span>
            </button>
          )}
          <button onClick={openUserInfoBot} className="btn-secondary">
            <ExternalLink className="h-4 w-4" />
            <span>أو استخدم @userinfobot</span>
          </button>
        </div>

        <Field label="Chat ID" hint="سيُملأ تلقائياً بعد إرسال /start للبوت.">
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="مثال: 123456789"
            className="input-field"
            inputMode="numeric"
            dir="ltr"
          />
        </Field>

        <PrivateChannelGuide botUsername={botInfo?.username} />
      </StepCard>

      {/* Why not Saved Messages? */}
      <SavedMessagesNote />

      {/* STEP 3 — Save */}
      <StepCard n={3} title="اختبر واحفظ" done={active} muted={!canSave}>
        {testInfo && (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            {testInfo}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={doTest} disabled={!canSave || testing} className="btn-secondary">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span>اختبار الاتصال</span>
          </button>
          <button onClick={() => doSave(false)} disabled={!canSave} className="btn-secondary">
            حفظ فقط
          </button>
          <button onClick={() => doSave(true)} disabled={!canSave} className="btn-primary">
            حفظ وجعله المزود النشط
          </button>
          {active && (
            <span className="ms-auto flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" /> نشط الآن
            </span>
          )}
        </div>
      </StepCard>

      {/* Topic routing (Forum groups) */}
      <TopicRulesPanel />
    </div>
  );
}


function StepCard({
  n,
  title,
  done,
  muted,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border p-5 transition",
        done
          ? "border-primary/40 bg-primary/[0.04]"
          : muted
          ? "border-border/60 bg-card/60 opacity-70"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
            done ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}


// ---------------- Telegram: Private Channel Guide ---------------------------
function PrivateChannelGuide({ botUsername }: { botUsername?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.05]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-medium text-primary"
      >
        <Shield className="h-4 w-4" />
        <span className="flex-1 text-start">
          الطريقة الموصى بها: أنشئ قناة خاصة تعمل كـ "Saved Messages" (اضغط للتفاصيل)
        </span>
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-primary/20 px-4 py-3 text-[12px] leading-relaxed text-foreground/85">
          <p>
            البوتات لا تستطيع الوصول إلى <b>Saved Messages</b> الخاصة بك (حماية من تيليجرام).
            الحل الأنيق: أنشئ قناة خاصة بك أنت فقط وأضف بوتك كأدمن — ستحصل على نفس تجربة
            Saved Messages: متزامنة على كل أجهزتك، بحث كامل، ومنظمة في مكان واحد.
          </p>
          <ol className="space-y-1.5 ps-4 [list-style:decimal]">
            <li>في تيليجرام: <b>New Channel</b> → اختر اسماً مثل "📸 My Photos" → <b>Private</b>.</li>
            <li>افتح القناة → <b>Manage → Administrators → Add Admin</b> → ابحث عن بوتك
              {botUsername ? <> (<code className="rounded bg-secondary px-1" dir="ltr">@{botUsername}</code>)</> : null}
              {" "}واعطه صلاحية <b>Post Messages</b>.
            </li>
            <li>
              أرسل أي رسالة في القناة، ثم افتح
              {" "}<a
                href={botUsername ? `https://t.me/${botUsername}` : "#"}
                target="_blank"
                rel="noopener"
                className="text-primary underline"
              >محادثة البوت</a>{" "}
              وأرسل <code className="rounded bg-secondary px-1">/start</code> — سيلتقط التطبيق الـ Chat ID
              (يبدأ بـ <code dir="ltr">-100…</code>).
            </li>
            <li>الصق معرّف القناة في حقل Chat ID أعلاه واحفظ. سيصبح كل ما ترفعه محفوظاً هناك.</li>
          </ol>
          <div className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
            🔒 هل هذا آمن؟ نعم — التوكن يبقى في متصفحك فقط، والبوت لا يرى إلا القناة التي أضفته إليها.
            لو ضاع التوكن يوماً، احذف البوت من BotFather وينتهي كل شيء بدون أي تأثير على حسابك.
          </div>
        </div>
      )}
    </div>
  );
}

function SavedMessagesNote() {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <b className="text-foreground/80">لماذا لا نستخدم Saved Messages مباشرة؟</b> لأن ذلك يتطلب
      تسجيل دخول بحسابك الكامل (رقم + SMS + 2FA) عبر MTProto، ما يُنشئ جلسة بصلاحيات حسابك بالكامل.
      استخدام بوت + قناة خاصة يعطي نفس النتيجة مع أمان أعلى بكثير: لو تسرّب أي شيء، تحذف البوت وتنتهي المشكلة.
    </div>
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
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (cfg?.baseUrl) setBaseUrl(cfg.baseUrl);
  }, [cfg]);

  const canTest = /^https?:\/\/.+/.test(baseUrl.trim());

  const doTest = async () => {
    setTesting(true);
    setTestInfo(null);
    try {
      const info = await localServerTest(baseUrl.trim());
      setTestInfo(`الخادم متاح ✓ ${JSON.stringify(info).slice(0, 160)}`);
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
    <div className="space-y-4">
      {/* STEP 1 — get the server code */}
      <StepCard n={1} title="ثبّت الخادم على جهازك">
        <p className="text-xs leading-relaxed text-muted-foreground">
          خادم Node.js صغير (ملف واحد) يستقبل الصور ويحفظها في مجلد على قرصك.
          يعمل داخل شبكتك المحلية فقط — لا شيء يخرج للإنترنت.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowCode((v) => !v)} className="btn-secondary">
            <Terminal className="h-4 w-4" />
            <span>{showCode ? "إخفاء الكود" : "عرض كود الخادم"}</span>
            <ChevronDown className={cn("h-4 w-4 transition", showCode && "rotate-180")} />
          </button>
          <button
            onClick={() => downloadText("server.js", LOCAL_SERVER_CODE)}
            className="btn-secondary"
          >
            <Download className="h-4 w-4" />
            <span>تحميل server.js</span>
          </button>
          <button
            onClick={() => downloadText("package.json", LOCAL_SERVER_PACKAGE_JSON)}
            className="btn-secondary"
          >
            <Download className="h-4 w-4" />
            <span>تحميل package.json</span>
          </button>
        </div>

        {showCode && (
          <div className="space-y-2">
            <CodeBlock title="server.js" code={LOCAL_SERVER_CODE} />
            <CodeBlock title="package.json" code={LOCAL_SERVER_PACKAGE_JSON} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[12px] leading-relaxed">
          <div className="mb-1.5 font-medium text-foreground/90">خطوات التشغيل:</div>
          <ol className="space-y-1 ps-4 text-muted-foreground [list-style:decimal]">
            <li>ثبّت <b>Node.js 18+</b> من <a href="https://nodejs.org" target="_blank" rel="noopener" className="text-primary underline">nodejs.org</a>.</li>
            <li>ضع الملفين في مجلد جديد (مثلاً <code dir="ltr">~/localgallery-server</code>).</li>
            <li>في الطرفية داخل المجلد شغّل:
              <pre className="mt-1 overflow-x-auto rounded bg-background/60 p-2 text-[11px]" dir="ltr">npm install{"\n"}npm start</pre>
            </li>
            <li>سيطبع الخادم عنوانه، والصور ستُحفظ في <code dir="ltr">./storage/YYYY/MM/</code>.</li>
          </ol>
        </div>
      </StepCard>

      {/* STEP 2 — configure address */}
      <StepCard n={2} title="اربط التطبيق بالخادم" done={active}>
        <p className="text-xs text-muted-foreground">
          اكتب عنوان جهازك على الشبكة المحلية. لمعرفة IP جهازك:
          {" "}<code dir="ltr">ipconfig</code> (Windows) أو <code dir="ltr">ifconfig</code> (macOS/Linux).
          يجب أن يكون هاتفك على نفس شبكة الواي-فاي.
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
            <span className="ms-auto flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" /> نشط الآن
            </span>
          )}
        </div>
      </StepCard>

      <div className="rounded-xl border border-border/60 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <FolderOpen className="me-1 inline h-3.5 w-3.5" />
        الملفات تُنظَّم تلقائياً حسب السنة والشهر. غيّر مجلد التخزين بمتغير البيئة
        {" "}<code dir="ltr">STORAGE_DIR=/path/to/photos npm start</code>.
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`تم نسخ ${title}`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/70">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/50 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{title}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "تم النسخ" : "نسخ"}</span>
        </button>
      </div>
      <pre
        className="max-h-72 overflow-auto p-3 text-[11px] leading-relaxed"
        dir="ltr"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
