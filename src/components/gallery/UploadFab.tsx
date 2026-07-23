import { useRef, useState } from "react";
import { Images, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";
import { photoDb, type MediaAsset } from "@/lib/photoDb";
import { extractExif } from "@/lib/exif";
import { extractVideoMeta, isVideoMime } from "@/lib/video";

async function importWebFiles(files: FileList) {
  let inserted = 0;
  for (const file of Array.from(files)) {
    const id = `web-${file.size}-${file.lastModified}-${file.name}`;
    if (await photoDb.assets.get(id)) continue;
    const isVideo = isVideoMime(file.type);
    let width: number | undefined;
    let height: number | undefined;
    let dateTaken = file.lastModified || Date.now();
    let posterDataUrl: string | undefined;
    let duration: number | undefined;
    try {
      if (isVideo) {
        const m = await extractVideoMeta(file);
        width = m.width; height = m.height; duration = m.duration; posterDataUrl = m.posterDataUrl;
      } else {
        const exif = await extractExif(file);
        width = exif.width; height = exif.height; dateTaken = exif.dateTaken ?? dateTaken;
      }
    } catch { /* keep going */ }
    const asset: MediaAsset = {
      id, provider: "device", name: file.name, size: file.size,
      mime: file.type || (isVideo ? "video/*" : "image/*"),
      width, height, date: dateTaken, createdAt: Date.now(),
      kind: isVideo ? "video" : "image", blob: file,
      ...(posterDataUrl ? { posterDataUrl } : {}),
      ...(duration ? { duration } : {}),
    };
    await photoDb.assets.put(asset);
    inserted++;
  }
  return inserted;
}

interface Props { compact?: boolean }

export function UploadFab({ compact }: Props) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const importDevice = async () => {
    setBusy(true);
    try {
      const n = await scanDeviceGallery();
    if (n === 0) toast.info("لم يتم استيراد شيء — امنح صلاحية كل الصور أو اختر الصور من المنتقي");
      else toast.success(`تم استيراد ${n} عنصر`);
    } catch (e) {
      toast.error("فشل الاستيراد: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const onWebFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const n = await importWebFiles(list);
      toast.success(`أُضيف ${n} عنصر`);
    } catch (e) {
      toast.error("فشل الاستيراد: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const trigger = () => {
    if (canScanDeviceGallery()) importDevice();
    else fileInput.current?.click();
  };

  return (
    <>
      <input ref={fileInput} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={(e) => onWebFiles(e.currentTarget.files)} />
      <input ref={dirInput} type="file" multiple className="hidden"
        // @ts-expect-error - non-standard directory pickers
        webkitdirectory="" directory=""
        onChange={(e) => onWebFiles(e.currentTarget.files)} />

      {compact ? (
        <button
          disabled={busy}
          onClick={trigger}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
          استيراد
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={trigger}
          aria-label="استيراد"
          className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-fab hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Images className="h-6 w-6" />}
        </button>
      )}

      {!canScanDeviceGallery() && (
        <button
          onClick={() => dirInput.current?.click()}
          className="fixed bottom-20 right-24 z-40 rounded-full bg-secondary px-3 py-2 text-xs font-medium"
        >
          مجلد
        </button>
      )}
    </>
  );
}
