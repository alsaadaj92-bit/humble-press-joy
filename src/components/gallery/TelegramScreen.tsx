import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { useProviders } from "@/hooks/useProviders";
import { useTelegramFeed, useRemoteAssetUrls } from "@/hooks/useTelegramFeed";
import { photoDb } from "@/lib/photoDb";
import { PhotoGrid } from "./PhotoGrid";
import { Lightbox } from "./Lightbox";
import { EmptyState } from "./EmptyState";
import { useGridDensity } from "@/hooks/useGridDensity";
import { runViewTransition } from "@/lib/viewTransition";
import type { MockPhoto } from "@/lib/mockPhotos";

export function TelegramScreen() {
  const { providers } = useProviders();
  const tg = providers.get("telegram");
  const ready = !!tg?.configured && !!tg.botToken;
  const [pollTick, setPollTick] = useState(0);
  const { lastError, lastPolledAt } = useTelegramFeed(ready, 15000, pollTick);
  const assets = useMediaAssets({ kind: "telegram-remote" });
  const urls = useRemoteAssetUrls(assets);
  const { density } = useGridDensity();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const photos = useMemo<MockPhoto[]>(() => assets.map((a) => {
    const url = urls.get(a.id);
    return {
      id: a.id, seed: a.id,
      width: a.width ?? 400, height: a.height ?? 400,
      date: new Date(a.date), name: a.name,
      thumbSrc: (a.kind === "video" ? a.posterDataUrl : url) ?? url,
      fullSrc: url,
      kind: a.kind === "video" ? "video" : "image",
      duration: a.duration, mime: a.mime, provider: a.provider,
    };
  }), [assets, urls]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 2500);
    return () => clearTimeout(t);
  }, [busy]);

  const refresh = () => { setBusy(true); setPollTick((t) => t + 1); };

  const resync = async () => {
    setBusy(true);
    // Reset the stored update offset so the next poll asks Telegram for the
    // full window it still remembers (~24h). Historical messages from before
    // the bot was added are NOT retrievable — that's a Telegram Bot API limit.
    await photoDb.kv.delete("tg:updates:offset");
    setPollTick((t) => t + 1);
    toast.info("سيقوم البوت بجلب كل ما يتذكره تليكرام (آخر 24 ساعة).");
  };

  return (
    <div className="min-h-full pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur safe-top">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">معرض تليكرام</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {assets.length} عنصر · {lastPolledAt ? "آخر تحديث الآن" : "بانتظار الرسائل"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resync}
            disabled={!ready || busy}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
            title="إعادة الجلب من البداية"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            إعادة الفهرسة
          </button>
          <button
            onClick={refresh}
            disabled={!ready || busy}
            className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            تحديث
          </button>
        </div>
      </header>

      {!ready && (
        <div className="mx-4 mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          أضف بوت تليكرام من الإعدادات لعرض الصور من مجموعتك.
        </div>
      )}
      {lastError && (
        <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
          خطأ من تليكرام: {lastError}
        </div>
      )}
      {ready && assets.length === 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">لماذا لا أرى صوري القديمة؟</p>
          <p className="mb-2">
            هذا قيد من تليكرام نفسه: البوت لا يستطيع قراءة الرسائل التي أُرسلت قبل إضافته،
            ولا يوجد أي API يمكّن البوت من تصفح محفوظات المجموعة/القناة.
          </p>
          <p className="mb-2 font-semibold text-foreground">الحل الوحيد لاستيراد القديم:</p>
          <ol className="list-decimal space-y-1 pr-4">
            <li>افتح المجموعة/القناة في تليكرام.</li>
            <li>اضغط على كل صورة/فيديو قديم → مشاركة → أرسل للبوت مباشرة.</li>
            <li>ستظهر الصورة هنا خلال ثوانٍ.</li>
          </ol>
          <p className="mt-3">
            كل الصور الجديدة التي ترفعها من هذا التطبيق أو ترسلها للبوت ستظهر تلقائياً.
          </p>
        </div>
      )}

      <div className="px-2 py-3">
        <PhotoGrid
          photos={photos}
          onOpen={(i) => runViewTransition(() => setLightbox(i))}
          density={density}
          activeId={lightbox != null ? photos[lightbox]?.id : null}
          emptyContent={null}
        />
      </div>

      {lightbox != null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
          showDownload
        />
      )}
    </div>
  );
}
