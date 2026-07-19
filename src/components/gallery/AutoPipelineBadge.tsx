import { Loader2, Sparkles } from "lucide-react";
import { useAutoPipelineStatus } from "@/hooks/useAutoPipeline";

/** Compact indicator shown in TopBar when background AI is working. */
export function AutoPipelineBadge() {
  const s = useAutoPipelineStatus();
  if (!s.running && s.queued === 0) return null;
  return (
    <div className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary md:flex">
      {s.running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      <span className="tabular-nums">
        {s.currentTask ?? "معالجة"} · {s.queued} متبقٍ
      </span>
    </div>
  );
}
