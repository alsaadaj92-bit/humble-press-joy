import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { useProviders } from "@/hooks/useProviders";
import { useTelegramFeed, useRemoteAssetUrls } from "@/hooks/useTelegramFeed";
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
  const { lastError, lastPolledAt } = useTelegramFeed(ready);
  const assets = useMediaAssets({ kind: "telegram-remote" });
  const urls = useRemoteAssetUrls(assets);
  const { density } = useGridDensity();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

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
    if (!polling) return;
    const t = setTimeout(() => setPolling(false), 2000);
    return () => clearTimeout(t);
  }, [polling]);

  return (
    <div className="min-h-full pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur safe-top">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">معرض تليكرام</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {assets.length} عنصر · {lastPolledAt ? "آخر تحديث الآن" : "بانتظار الرسائل الجديدة"}
          </p>
        </div>
        <button
          onClick={() => setPolling(true)}
          className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold"
        >
          {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحديث
        </button>
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
        <div className="mx-4 mt-4 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          تليكرام لا يرسل الرسائل القديمة عبر getUpdates. سترى هنا كل صورة/فيديو جديد يصل للبوت من الآن.
        </div>
      )}

      <div className="px-2 py-3">
        <PhotoGrid
          photos={photos}
          onOpen={(i) => runViewTransition(() => setLightbox(i))}
          density={density}
          activeId={lightbox != null ? photos[lightbox]?.id : null}
          emptyContent={
            ready ? (
              <EmptyState
                title="لا صور بعد"
                body="أرسل صورة أو فيديو من مجموعتك للبوت — ستظهر هنا خلال ثوانٍ."
              />
            ) : null
          }
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
