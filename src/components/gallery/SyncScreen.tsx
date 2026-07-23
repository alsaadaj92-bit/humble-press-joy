import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { useProviders } from "@/hooks/useProviders";
import { useSyncProgress, useSyncSettings } from "@/hooks/useSyncEngine";
import { runSyncCycle, setSyncSettings } from "@/lib/syncEngine";
import { PhotoGrid } from "./PhotoGrid";
import { Lightbox } from "./Lightbox";
import { UploadFab } from "./UploadFab";
import { EmptyState } from "./EmptyState";
import { useGridDensity } from "@/hooks/useGridDensity";
import { runViewTransition } from "@/lib/viewTransition";
import type { MockPhoto } from "@/lib/mockPhotos";

export function SyncScreen() {
  const assets = useMediaAssets({ kind: "unsynced-device" });
  const { providers } = useProviders();
  const tg = providers.get("telegram");
  const progress = useSyncProgress();
  const settings = useSyncSettings();
  const { density } = useGridDensity();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const next = new Map<string, string>();
    for (const a of assets) {
      if (a.blob) next.set(a.id, URL.createObjectURL(a.blob));
    }
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [assets]);

  const photos = useMemo<MockPhoto[]>(() => assets.map((a) => {
    const url = urls.get(a.id) ?? a.localUri;
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

  const tgReady = !!tg?.configured && !!tg.botToken && !!tg.chatId;

  return (
    <div className="min-h-full pb-28">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur safe-top">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">للمزامنة</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {progress.running
              ? `جارٍ الرفع… ${progress.done}/${progress.total} · ${progress.currentName ?? ""}`
              : assets.length === 0
              ? "لا يوجد شيء بانتظار الرفع"
              : `${assets.length} عنصر جاهز للرفع`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadFab compact />
          <button
            onClick={() => runSyncCycle()}
            disabled={!tgReady || progress.running || assets.length === 0}
            className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            مزامنة الآن
          </button>
        </div>
      </header>

      {progress.running && progress.total > 0 && (
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((progress.done + progress.failed) / progress.total) * 100}%` }}
          />
        </div>
      )}

      {!tgReady && (
        <div className="mx-4 mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          اضبط بوت تليكرام والشات من الإعدادات لبدء المزامنة.
        </div>
      )}

      {settings.paused && (
        <div className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <span>المزامنة موقوفة مؤقتاً</span>
          <button
            onClick={() => setSyncSettings({ paused: false })}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            استئناف
          </button>
        </div>
      )}

      <div className="px-2 py-3">
        <PhotoGrid
          photos={photos}
          onOpen={(i) => runViewTransition(() => setLightbox(i))}
          density={density}
          activeId={lightbox != null ? photos[lightbox]?.id : null}
          emptyContent={
            <EmptyState
              title="لا صور بانتظار المزامنة"
              body="استورد من معرض هاتفك ثم اضغط مزامنة — بعد رفع كل صورة ستختفي من هنا وتظهر في تبويب «معرض تليكرام»."
            />
          }
        />
      </div>

      {lightbox != null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
