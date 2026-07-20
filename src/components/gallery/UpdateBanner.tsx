import { Download, X, Sparkles } from "lucide-react";
import { useOtaCheck } from "@/hooks/useOtaCheck";
import { launchApkInstall } from "@/lib/ota";

/** Sticky top banner shown when a newer GitHub release is available. */
export function UpdateBanner() {
  const { info, dismissed, dismiss } = useOtaCheck();
  if (!info?.available || dismissed) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-primary/30 bg-primary/15 px-3 py-2 text-sm backdrop-blur">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          تحديث متاح — الإصدار {info.latestVersion}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          نسختك الحالية {info.currentVersion}
        </p>
      </div>
      {info.apkUrl ? (
        <button
          onClick={() => launchApkInstall(info.apkUrl!)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Download className="h-3.5 w-3.5" />
          تحميل وتثبيت
        </button>
      ) : info.htmlUrl ? (
        <a
          href={info.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          فتح الإصدار
        </a>
      ) : null}
      <button
        onClick={dismiss}
        aria-label="إغلاق"
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
