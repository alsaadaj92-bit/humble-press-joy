import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FolderPlus,
  Hash,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirmDialog";
import { useAlbums } from "@/hooks/useAlbums";
import { useAlbumMemberIndex } from "@/hooks/useAlbumMembers";
import { useProviders } from "@/hooks/useProviders";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { telegramCreateForumTopic } from "@/lib/providers/telegram";
import { setAlbumTopic, getUploaderName } from "@/lib/albums";
import {
  createManualAlbum,
  deleteManualAlbum,
  renameManualAlbum,
  removeAssetsFromAlbum,
} from "@/lib/manualAlbums";
import { downloadAlbumZip, shareAlbumToTelegram } from "@/lib/share";
import type { Album } from "@/lib/photoDb";
import { cn } from "@/lib/utils";

export function AlbumsPanel() {
  const albums = useAlbums();
  const memberIndex = useAlbumMemberIndex();
  const { providers, active } = useProviders();
  const assets = useMediaAssets();
  const tg = providers.get("telegram");
  const isTgReady = Boolean(
    active === "telegram" && tg?.configured && tg?.botToken && tg?.chatId,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [progress, setProgress] = useState<{ id: string; label: string } | null>(null);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const manual = albums
    .filter((a) => a.kind === "manual")
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const years = albums
    .filter((a) => a.kind === "auto-year")
    .sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));
  const months = albums
    .filter((a) => a.kind === "auto-month")
    .sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));

  const autoBind = async (album: Album) => {
    if (!isTgReady) {
      toast.error("فعّل تيليجرام كمزود نشط أولاً");
      return;
    }
    setBusy(album.id);
    try {
      const res = await telegramCreateForumTopic(
        tg!.botToken!,
        tg!.chatId!,
        album.name,
      );
      await setAlbumTopic(album.id, res.message_thread_id);
      toast.success(`أُنشئ موضوع «${album.name}»`, {
        description: `topic id = ${res.message_thread_id}`,
      });
    } catch (e) {
      toast.error("تعذّر إنشاء الموضوع", {
        description:
          e instanceof Error
            ? e.message
            : "تأكد أن المجموعة Forum والبوت أدمن.",
      });
    } finally {
      setBusy(null);
    }
  };

  const manualBind = async (album: Album) => {
    const input = window.prompt(
      `أدخل topic id للألبوم «${album.name}»:`,
      album.topicId ? String(album.topicId) : "",
    );
    if (input === null) return;
    const n = Number(input.trim());
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("رقم غير صالح");
      return;
    }
    await setAlbumTopic(album.id, n);
    toast.success("تم الربط");
  };

  const unbind = async (album: Album) => {
    await setAlbumTopic(album.id, undefined);
    toast.success("أُلغي الربط");
  };

  const createNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createManualAlbum(name);
      setNewName("");
      toast.success(`أُنشئ ألبوم «${name}»`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
    }
  };

  const rename = async (a: Album) => {
    const name = window.prompt("اسم الألبوم:", a.name);
    if (!name) return;
    await renameManualAlbum(a.id, name);
    toast.success("تم التحديث");
  };

  const remove = async (a: Album) => {
    if (!(await confirmDialog({ title: "حذف الألبوم", message: `حذف ألبوم «${a.name}»؟ الصور تبقى محفوظة.`, destructive: true, confirmText: "حذف" }))) return;
    await deleteManualAlbum(a.id);
    toast.success("حُذف الألبوم");
  };

  const albumAssets = (id: string) => {
    const ids = memberIndex.get(id);
    if (!ids) return [];
    return Array.from(ids)
      .map((aid) => assetMap.get(aid))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  };

  const doDownload = async (a: Album) => {
    const list = albumAssets(a.id);
    if (!list.length) {
      toast.error("الألبوم فارغ");
      return;
    }
    setBusy(a.id);
    try {
      await downloadAlbumZip(a.name, list, providers, (p) =>
        setProgress({ id: a.id, label: `${p.index}/${p.total} · ${p.name}` }),
      );
      toast.success(`تم تنزيل «${a.name}» كملف مضغوط`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التنزيل");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const doTelegramShare = async (a: Album) => {
    if (!isTgReady) {
      toast.error("فعّل تيليجرام كمزود نشط");
      return;
    }
    const list = albumAssets(a.id);
    if (!list.length) {
      toast.error("الألبوم فارغ");
      return;
    }
    setBusy(a.id);
    try {
      const uploader = await getUploaderName();
      await shareAlbumToTelegram(
        a.name,
        list,
        providers,
        {
          botToken: tg!.botToken!,
          chatId: tg!.chatId!,
          topicId: a.topicId,
          uploaderName: uploader || undefined,
        },
        (p) =>
          setProgress({ id: a.id, label: `${p.index}/${p.total} · ${p.name}` }),
      );
      toast.success(`أُرسل «${a.name}» إلى تيليجرام`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const removeAsset = async (albumId: string, assetId: string) => {
    await removeAssetsFromAlbum(albumId, [assetId]);
  };

  const AutoRow = ({ a }: { a: Album }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {a.topicId != null ? (
            <>
              مرتبط بموضوع تيليجرام{" "}
              <span dir="ltr" className="font-mono">#{a.topicId}</span>
            </>
          ) : (
            "غير مرتبط بموضوع بعد"
          )}
        </p>
      </div>
      {a.topicId != null ? (
        <button onClick={() => unbind(a)} className="btn-secondary text-xs">
          <X className="h-3.5 w-3.5" />
          <span>إلغاء</span>
        </button>
      ) : (
        <>
          <button
            disabled={!isTgReady || busy === a.id}
            onClick={() => autoBind(a)}
            className="btn-primary text-xs disabled:opacity-40"
          >
            {busy === a.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span>إنشاء تلقائي</span>
          </button>
          <button onClick={() => manualBind(a)} className="btn-secondary text-xs">
            <Hash className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  const ManualCard = ({ a }: { a: Album }) => {
    const list = albumAssets(a.id);
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {list.length} عنصر
              {a.topicId != null && (
                <>
                  {" · مرتبط بـ "}
                  <span dir="ltr" className="font-mono">#{a.topicId}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => rename(a)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            title="إعادة تسمية"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => remove(a)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {list.length > 0 && (
          <div className="mb-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {list.slice(0, 16).map((asset) => (
              <button
                key={asset.id}
                onClick={() => removeAsset(a.id, asset.id)}
                className="group relative aspect-square overflow-hidden rounded-md bg-secondary"
                title={`حذف ${asset.name} من الألبوم`}
              >
                {asset.posterDataUrl ? (
                  <img
                    src={asset.posterDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[9px] text-muted-foreground">
                    {asset.name.slice(0, 4)}
                  </div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                  <X className="h-4 w-4 text-white" />
                </span>
              </button>
            ))}
            {list.length > 16 && (
              <div className="grid aspect-square place-items-center rounded-md bg-secondary text-[11px] text-muted-foreground">
                +{list.length - 16}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy === a.id || !list.length}
            onClick={() => doDownload(a)}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            {busy === a.id && progress?.id === a.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>تنزيل ZIP</span>
          </button>
          <button
            disabled={!isTgReady || busy === a.id || !list.length}
            onClick={() => doTelegramShare(a)}
            className="btn-primary text-xs disabled:opacity-40"
            title={
              a.topicId != null
                ? "إرسال إلى الموضوع المرتبط"
                : "إرسال إلى المجموعة العامة"
            }
          >
            <Send className="h-3.5 w-3.5" />
            <span>مشاركة عبر تيليجرام</span>
          </button>
          {a.topicId == null ? (
            <button
              disabled={!isTgReady || busy === a.id}
              onClick={() => autoBind(a)}
              className="btn-secondary text-xs disabled:opacity-40"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>ربط بموضوع تيليجرام</span>
            </button>
          ) : (
            <button onClick={() => unbind(a)} className="btn-secondary text-xs">
              <X className="h-3.5 w-3.5" />
              <span>فكّ الربط</span>
            </button>
          )}
        </div>

        {progress?.id === a.id && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {progress.label}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h1 className="text-2xl font-bold">الألبومات</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          الألبومات اليدوية للتنظيم والمشاركة، وألبومات السنة/الشهر التلقائية
          من تواريخ EXIF. أي ألبوم يمكن ربطه بموضوع (Topic) في مجموعة تيليجرام.
        </p>
        <p className={cn("mt-2 text-[11px]", isTgReady ? "text-primary" : "text-amber-500")}>
          {isTgReady
            ? "✓ تيليجرام نشط — المشاركة والربط التلقائي متاحان."
            : "فعّل تيليجرام كمزود نشط للمشاركة والربط التلقائي."}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/90">
          ألبوماتي اليدوية
        </h2>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNew()}
            placeholder="اسم ألبوم جديد..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            disabled={!newName.trim()}
            onClick={createNew}
            className="btn-primary text-xs disabled:opacity-40"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>إنشاء</span>
          </button>
        </div>
        {manual.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
            ابدأ بإنشاء ألبوم، ثم حدّد صوراً وأضفها من شريط التحديد.
          </p>
        ) : (
          <div className="space-y-3">
            {manual.map((a) => (
              <ManualCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      {months.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/90">حسب الشهر</h2>
          <div className="space-y-2">
            {months.map((a) => (
              <AutoRow key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/90">حسب السنة</h2>
          <div className="space-y-2">
            {years.map((a) => (
              <AutoRow key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
