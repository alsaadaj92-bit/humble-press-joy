import { useEffect, useState } from "react";
import { photoDb, type MediaAsset, type ProviderConfig, type ProviderKind } from "@/lib/photoDb";
import { resolveAssetUrl } from "@/lib/providers";
import type { MockPhoto } from "@/lib/mockPhotos";

/**
 * Resolves URLs for every asset (with in-memory cache) and produces a
 * MockPhoto-compatible list so it can flow through the existing grid + lightbox.
 * For Telegram assets, the URL requires a getFile call — this hook triggers
 * that once per asset and updates state as URLs come back.
 */
export function useResolvedAssets(
  assets: MediaAsset[],
  providers: Map<ProviderKind, ProviderConfig>,
): MockPhoto[] {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = new Map(urls);
      let changed = false;
      for (const asset of assets) {
        if (next.has(asset.id)) continue;
        try {
          const cfg = providers.get(asset.provider);
          const url = await resolveAssetUrl(asset, cfg);
          if (cancelled) return;
          next.set(asset.id, url);
          changed = true;
        } catch {
          // leave unresolved; will be retried next render cycle
        }
      }
      if (changed && !cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
    // urls intentionally excluded to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, providers]);

  return assets.map((a) => {
    const url = urls.get(a.id);
    const w = a.width ?? 400;
    const h = a.height ?? 400;
    const isVideo = a.kind === "video" || a.mime.startsWith("video/");
    return {
      id: a.id,
      seed: a.id,
      width: w,
      height: h,
      date: new Date(a.date),
      name: a.name,
      thumbSrc: isVideo ? a.posterDataUrl ?? url : url,
      fullSrc: url,
      provider: a.provider,
      kind: isVideo ? "video" : "image",
      duration: a.duration,
      mime: a.mime,
    } as MockPhoto;
  });
}

// Utility: touch photoDb so this file's imports stay tree-shakeable.
void photoDb;
