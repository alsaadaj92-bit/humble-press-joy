import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2, Bug, AlertTriangle, Info, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildDiagnosticsReport,
  clearDiagnostics,
  subscribeDiagnostics,
  type DiagEntry,
  type DiagCategory,
} from "@/lib/diagnostics";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";
import { nativeShareText, saveBlobToDevice, isNative } from "@/lib/native";

/**
 * In-app runtime telemetry viewer.
 *
 * Records: environment, timeline, touches, permissions, AI ops, IndexedDB,
 * performance, native events, network calls, and errors. Users copy/share/
 * download a full report to hand off for offline analysis.
 */
const CATEGORIES: { key: DiagCategory | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "timeline", label: "الجدول" },
  { key: "touch", label: "لمسات" },
  { key: "perm", label: "أذونات" },
  { key: "ai", label: "AI" },
  { key: "idb", label: "IDB" },
  { key: "perf", label: "أداء" },
  { key: "native", label: "نيتف" },
  { key: "net", label: "شبكة" },
  { key: "error", label: "أخطاء" },
];

export function DiagnosticsPanel() {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<DiagCategory | "all">("all");

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => (e.category ?? "app") === filter)),
    [entries, filter],
  );

  const copyReport = async () => {
    const report = buildDiagnosticsReport();
    try {
      await navigator.clipboard.writeText(report);
      toast.success("تم نسخ التقرير الكامل");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast.success("تم نسخ التقرير"); }
      catch { toast.error("تعذّر النسخ"); }
      finally { document.body.removeChild(ta); }
    }
  };

  const downloadReport = async () => {
    const report = buildDiagnosticsReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const name = `telemetry-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    if (isNative()) {
      const uri = await saveBlobToDevice(name, blob);
      if (uri) { toast.success(`حُفظ في المستندات: ${name}`); return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل التقرير");
  };

  const shareReport = async () => {
    const report = buildDiagnosticsReport();
    try {
      const ok = await nativeShareText("Telemetry Report", report);
      if (!ok) await copyReport();
    } catch {
      await copyReport();
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
          <p className="text-sm font-medium">تشخيصات وتيليمتري مباشرة</p>
          <p className="text-[11px] text-muted-foreground">
            {entries.length} حدث · {errors} خطأ · {warns} تحذير
          </p>
        </div>
        <button
          onClick={copyReport}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Copy className="h-3.5 w-3.5" /> نسخ
        </button>
        <button
          onClick={downloadReport}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          title="تنزيل ملف .log"
        >
          <Download className="h-3.5 w-3.5" /> تنزيل
        </button>
        <button
          onClick={shareReport}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          title="مشاركة"
        >
          <Share2 className="h-3.5 w-3.5" /> مشاركة
        </button>
        <button
          onClick={clear}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
          title="مسح"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/60 p-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
              filter === c.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">لا توجد سجلات لهذه الفئة.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-xs">
            {[...filtered].reverse().slice(0, 200).map((e, idx) => {
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
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {e.category ?? "app"}·{e.scope}
                        </span>
                        {" "}<span className="font-medium">{e.message}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground" dir="ltr">
                        {new Date(e.ts).toLocaleTimeString()}
                      </p>
                    </div>
                  </button>
                  {isOpen && e.detail && (
                    <pre className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-secondary/60 p-2 text-[10px] leading-relaxed" dir="ltr">
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
