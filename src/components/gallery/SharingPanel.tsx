import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Link2,
  Send,
  Share2,
  Copy,
  Plus,
  Trash2,
  Download,
  Upload,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCollection,
  decodeCollection,
  deleteCollection,
  encodeCollection,
  importCode,
  listCollections,
  type SharedCollection,
} from "@/lib/shareCollections";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { photoDb } from "@/lib/photoDb";

/**
 * Real sharing panel — everything stays local:
 *   - Create local "shared collections" and export them as a base64 code
 *   - Import a code from another install (rebinds by asset id)
 *   - Web Share API to hand-off assets to installed apps (Telegram, mail…)
 * No servers, no cloud accounts — matches the Zero-Cloud policy.
 */
export function SharingPanel() {
  const [collections, setCollections] = useState<SharedCollection[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const assets = useMediaAssets();
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const reload = () => listCollections().then(setCollections);
  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    if (!assets.length) {
      toast.error("لا توجد صور مرفوعة عبر مزوّد بعد — أضف صوراً أولاً");
      return;
    }
    setBusy(true);
    try {
      // Default: latest 20 uploaded assets — user can tune later from selection.
      const ids = assets
        .slice()
        .sort((a, b) => b.date - a.date)
        .slice(0, 20)
        .map((a) => a.id);
      const col = await createCollection(name || `مشاركة ${new Date().toLocaleDateString("ar-EG")}`, ids);
      setName("");
      toast.success(`أُنشئت مجموعة "${col.name}" بـ ${col.assetIds.length} عنصر`);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (col: SharedCollection) => {
    const c = encodeCollection(col);
    await navigator.clipboard.writeText(c);
    toast.success("نُسخ رمز المشاركة — الصقه على جهاز آخر لاستيراد المجموعة");
  };

  const doImport = async () => {
    const stub = decodeCollection(code);
    if (!stub) {
      toast.error("رمز غير صالح");
      return;
    }
    setBusy(true);
    try {
      const col = await importCode(code);
      if (!col) throw new Error();
      const missing = col.assetIds.filter((id) => !assetMap.has(id)).length;
      toast.success(
        missing
          ? `استُوردت — ${col.assetIds.length - missing}/${col.assetIds.length} صور مطابقة محلياً`
          : `استُوردت المجموعة "${col.name}"`,
      );
      setCode("");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const shareNative = async (col: SharedCollection) => {
    const items = col.assetIds
      .map((id) => assetMap.get(id))
      .filter((a): a is NonNullable<typeof a> => !!a);
    if (!items.length) {
      toast.error("لا توجد أصول محلية مطابقة");
      return;
    }
    if (!("share" in navigator)) {
      toast.error("متصفحك لا يدعم Web Share");
      return;
    }
    try {
      // Try File-sharing when possible; fall back to a text summary.
      const files: File[] = [];
      for (const a of items.slice(0, 10)) {
        // Only for assets stored as blobs in a syncJob (best-effort local grab).
        const job = await photoDb.syncJobs.where("assetId").equals(a.id).first();
        if (job?.blob) {
          files.push(new File([job.blob], a.name, { type: a.mime }));
        }
      }
      if (files.length && "canShare" in navigator && (navigator as Navigator & { canShare: (d: ShareData) => boolean }).canShare({ files })) {
        await navigator.share({ files, title: col.name });
      } else {
        await navigator.share({
          title: col.name,
          text: `مشاركة "${col.name}" — ${items.length} عنصر (LocalGallery Pro)`,
        });
      }
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        toast.error("فشلت المشاركة");
      }
    }
  };

  const del = async (id: string) => {
    await deleteCollection(id);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* Quick actions row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickCard
          icon={<Users className="h-5 w-5" />}
          title="ألبوم مشترك جديد"
          desc="أنشئ مجموعة من آخر 20 صورة مرفوعة"
          onClick={create}
          disabled={busy}
        />
        <QuickCard
          icon={<Link2 className="h-5 w-5" />}
          title="استيراد من رمز"
          desc="ألصق رمز مشاركة من جهاز آخر"
          onClick={() => document.getElementById("share-import")?.focus()}
        />
        <QuickCard
          icon={<Send className="h-5 w-5" />}
          title="مشاركة سريعة"
          desc="استخدم Web Share لإرسال آخر مجموعة"
          onClick={() => collections[0] && shareNative(collections[0])}
          disabled={!collections.length}
        />
        <QuickCard
          icon={<Share2 className="h-5 w-5" />}
          title="مكتبة الشريك"
          desc="قاعدة توجيه تلقائي عبر مواضيع تيليجرام (من قواعد المواضيع)"
          onClick={() => toast.message("افتح 'قواعد المواضيع' لضبط التوجيه التلقائي")}
        />
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">مجموعة مشاركة جديدة</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المجموعة"
            className="flex-1 rounded-full border border-border bg-secondary px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={create}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            إنشاء من آخر 20 صورة
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          كل مجموعة تُخزَّن محلياً فقط. رمز المشاركة يحوي معرفات أصول
          مجهولة — لن يعمل إلا مع نفس المكتبة المحلية على الجهاز الآخر.
        </p>
      </div>

      {/* Import */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">استيراد من رمز</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="share-import"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ألصق رمز المشاركة هنا"
            className="flex-1 rounded-full border border-border bg-secondary px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={doImport}
            disabled={busy || !code.trim()}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            استيراد
          </button>
        </div>
      </div>

      {/* Collections list */}
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">المجموعات المشاركة</h3>
        </div>
        {collections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <Share2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold">لا توجد مجموعات بعد</h3>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              أنشئ مجموعتك الأولى من الأعلى، ثم انسخ الرمز لمشاركتها بين
              أجهزتك أو مع من يشغّل LocalGallery Pro بنفس المكتبة.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {collections.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.assetIds.length} عنصر ·{" "}
                    {new Date(c.createdAt).toLocaleString("ar-EG")}
                  </p>
                </div>
                <button
                  onClick={() => shareNative(c)}
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="مشاركة عبر النظام"
                  aria-label="مشاركة"
                >
                  <Send className="h-4 w-4" />
                </button>
                <button
                  onClick={() => copyCode(c)}
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="نسخ رمز المشاركة"
                  aria-label="نسخ الرمز"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([encodeCollection(c)], {
                      type: "text/plain",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${c.name}.share.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  title="تنزيل الرمز كملف"
                  aria-label="تنزيل"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => del(c.id)}
                  className="grid h-9 w-9 place-items-center rounded-full text-destructive transition hover:bg-destructive/10"
                  title="حذف"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-right transition hover:border-primary/40 hover:bg-accent disabled:opacity-50 disabled:hover:bg-card"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
