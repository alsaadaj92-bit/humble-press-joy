import { useEffect, useState } from "react";
import { Copy, Trash2, Bug, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  buildDiagnosticsReport,
  clearDiagnostics,
  subscribeDiagnostics,
  type DiagEntry,
} from "@/lib/diagnostics";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";

/**
 * In-app diagnostics viewer. Shows the last ~300 log entries and lets the
 * user copy a full report to share when something breaks (model download,
 * gallery scan, upload, etc.).
 */
export function DiagnosticsPanel() {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const copyReport = async () => {
    const report = buildDiagnosticsReport();
    try {
      await navigator.clipboard.writeText(report);
      toast.success("تم نسخ التقرير — الصقه لمن يساعدك");
    } catch {
      // Fallback: create a temp textarea
      const ta = document.createElement("textarea");
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast.success("تم نسخ التقرير"); }
      catch { toast.error("تعذّر النسخ"); }
      finally { document.body.removeChild(ta); }
    }
  };

  const clear = async () => {
    if (!(await confirmDialog({ title: "مسح السجلات", message: "مسح كل السجلات؟", destructive: true, confirmText: "مسح" }))) return;
    await clearDiagnostics();
    toast.success("تم المسح");
  };

  const errors = entries.filter((e) => e.level === "error").length;
  const warns = entries.filter((e) => e.level === "warn").length;

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
        <Bug className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">تشخيصات مباشرة</p>
          <p className="text-[11px] text-muted-foreground">
            {entries.length} حدث · {errors} خطأ · {warns} تحذير
          </p>
        </div>
        <button
          onClick={copyReport}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Copy className="h-3.5 w-3.5" /> نسخ التقرير
        </button>
        <button
          onClick={clear}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
          title="مسح"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">لا توجد سجلات — كل شيء يعمل.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-xs">
            {[...entries].reverse().slice(0, 100).map((e, idx) => {
              const isOpen = expanded === idx;
              const Icon = e.level === "error" ? AlertTriangle : e.level === "warn" ? AlertTriangle : Info;
              const color = e.level === "error"
                ? "text-destructive"
                : e.level === "warn"
                ? "text-amber-500"
                : "text-muted-foreground";
              return (
                <li key={idx} className="p-2.5">
                  <button
                    onClick={() => setExpanded(isOpen ? null : idx)}
                    className="flex w-full items-start gap-2 text-start"
                  >
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-mono text-[10px] text-muted-foreground">{e.scope}</span>
                        {" "}<span className="font-medium">{e.message}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground" dir="ltr">
                        {new Date(e.ts).toLocaleTimeString()}
                      </p>
                    </div>
                  </button>
                  {isOpen && e.detail && (
                    <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-secondary/60 p-2 text-[10px] leading-relaxed" dir="ltr">
                      {e.detail}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
