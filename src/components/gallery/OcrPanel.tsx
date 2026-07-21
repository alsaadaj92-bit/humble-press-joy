import { useEffect, useMemo, useState } from "react";
import { Loader2, ScanText, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { photoDb, type OcrRow } from "@/lib/photoDb";
import { ocrImage, saveOcr, deleteOcr, matchesOcr } from "@/lib/ocr";
import type { MockPhoto } from "@/lib/mockPhotos";
import { cn } from "@/lib/utils";

interface Props {
  photos: MockPhoto[];
  onOpen: (index: number) => void;
}

export function OcrPanel({ photos, onOpen }: Props) {
  const [rows, setRows] = useState<Map<string, OcrRow>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    const all = await photoDb.ocr.toArray();
    setRows(new Map(all.map((r) => [r.id, r])));
  };

  useEffect(() => {
    load();
    // Keep the Tesseract worker alive across tab switches so background
    // AutoPipeline scans don't get killed mid-run. It's released when the
    // page unloads.
  }, []);

  const imagePhotos = useMemo(
    () => photos.filter((p) => p.kind !== "video"),
    [photos],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return imagePhotos;
    return imagePhotos.filter((p) => matchesOcr(rows.get(p.id), query));
  }, [imagePhotos, rows, query]);

  const scanOne = async (p: MockPhoto) => {
    setBusyId(p.id);
    try {
      const src = p.fullSrc ?? p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/800/${p.height}`;
      const res = await ocrImage(src);
      await saveOcr(p.id, res);
      await load();
      if (!res.text) toast.info(`لم يُعثر على نص في ${p.name}`);
      else toast.success(`استُخرج نص من ${p.name}`);
    } catch (e) {
      toast.error(`فشل الفحص: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const scanAll = async () => {
    const targets = imagePhotos.filter((p) => !rows.has(p.id));
    if (!targets.length) {
      toast.info("كل الصور مفحوصة");
      return;
    }
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      try {
        const p = targets[i];
        const src = p.fullSrc ?? p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/800/${p.height}`;
        const res = await ocrImage(src);
        await saveOcr(p.id, res);
      } catch {
        /* keep going */
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setProgress(null);
    await load();
    toast.success("انتهى فحص جميع الصور");
  };

  const clearOne = async (id: string) => {
    await deleteOcr(id);
    await load();
  };

  const scanned = rows.size;
  const total = imagePhotos.length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">قراءة النصوص من الصور محلياً (OCR)</p>
          <p className="text-xs text-muted-foreground">
            يستخدم Tesseract.js داخل متصفحك — العربية والإنجليزية معاً. لا تُرسل الصور لأي خادم.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            تم فحص {scanned} / {total}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={scanAll} disabled={!!progress} size="sm">
            {progress ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارِ الفحص {progress.done}/{progress.total}
              </>
            ) : (
              <>
                <Play className="ml-2 h-4 w-4" />
                فحص كل الصور
              </>
            )}
          </Button>
        </div>
      </Card>

      <Input
        placeholder="ابحث داخل نص الصور… (مثال: فاتورة، total، رقم)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {query ? "لا توجد نتائج مطابقة." : "لا توجد صور بعد."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const row = rows.get(p.id);
            const thumb = p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/400/300`;
            const idx = photos.indexOf(p);
            return (
              <Card key={p.id} className="overflow-hidden">
                <button
                  onClick={() => onOpen(idx)}
                  className="block h-32 w-full overflow-hidden bg-muted"
                >
                  <img src={thumb} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                </button>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    {row && (
                      <span className="text-[10px] text-muted-foreground">
                        دقة {row.confidence}%
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-h-20 overflow-y-auto whitespace-pre-wrap rounded bg-muted/60 p-2 text-[11px] leading-relaxed",
                      !row?.text && "text-muted-foreground",
                    )}
                  >
                    {row?.text || (row ? "لم يُعثر على نص." : "لم يُفحص بعد.")}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === p.id || !!progress}
                      onClick={() => scanOne(p)}
                    >
                      {busyId === p.id ? (
                        <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ScanText className="ml-2 h-3.5 w-3.5" />
                      )}
                      {row ? "إعادة الفحص" : "فحص"}
                    </Button>
                    {row && (
                      <Button size="sm" variant="ghost" onClick={() => clearOne(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
