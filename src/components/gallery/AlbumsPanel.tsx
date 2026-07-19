import { useState } from "react";
import { CalendarDays, Hash, Loader2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useAlbums } from "@/hooks/useAlbums";
import { useProviders } from "@/hooks/useProviders";
import { telegramCreateForumTopic } from "@/lib/providers/telegram";
import { setAlbumTopic } from "@/lib/albums";
import type { Album } from "@/lib/photoDb";
import { cn } from "@/lib/utils";

export function AlbumsPanel() {
  const albums = useAlbums();
  const { providers, active } = useProviders();
  const tg = providers.get("telegram");
  const isTgReady = Boolean(
    active === "telegram" && tg?.configured && tg?.botToken && tg?.chatId,
  );
  const [busy, setBusy] = useState<string | null>(null);

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
      toast.success(`أُنشئ موضوع «${album.name}» في تيليجرام`, {
        description: `topic id = ${res.message_thread_id}`,
      });
    } catch (e) {
      toast.error("تعذّر إنشاء الموضوع", {
        description:
          e instanceof Error
            ? e.message
            : "تأكد أن المجموعة من نوع Forum وأن البوت أدمن مع صلاحية إدارة المواضيع.",
      });
    } finally {
      setBusy(null);
    }
  };

  const manualBind = async (album: Album) => {
    const input = window.prompt(
      `أدخل topic id يدوياً للألبوم «${album.name}»:`,
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

  const Row = ({ a }: { a: Album }) => (
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
        <button
          onClick={() => unbind(a)}
          className="btn-secondary text-xs"
          title="إلغاء الربط"
        >
          <X className="h-3.5 w-3.5" />
          <span>إلغاء</span>
        </button>
      ) : (
        <>
          <button
            disabled={!isTgReady || busy === a.id}
            onClick={() => autoBind(a)}
            className="btn-primary text-xs disabled:opacity-40"
            title="إنشاء موضوع تلقائياً في تيليجرام"
          >
            {busy === a.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span>إنشاء تلقائي</span>
          </button>
          <button
            onClick={() => manualBind(a)}
            className="btn-secondary text-xs"
            title="ربط يدوي بمعرّف موجود"
          >
            <Hash className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h1 className="text-2xl font-bold">الألبومات</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          تُنشأ ألبومات السنة والشهر تلقائياً من تواريخ الصور (EXIF). أي ألبوم
          يمكن ربطه بموضوع (Topic) في مجموعة تيليجرام — والصور التالية لنفس
          البازل ستُرفع مباشرة إلى ذلك الموضوع.
        </p>
        <p className={cn("mt-2 text-[11px]", isTgReady ? "text-primary" : "text-amber-500")}>
          {isTgReady
            ? "✓ تيليجرام نشط — الإنشاء التلقائي متاح."
            : "فعّل تيليجرام كمزود نشط ليصبح الإنشاء التلقائي متاحاً."}
        </p>
      </div>

      {albums.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          ستظهر الألبومات هنا بمجرد رفع أول صورة.
        </div>
      )}

      {months.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/90">حسب الشهر</h2>
          <div className="space-y-2">
            {months.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/90">حسب السنة</h2>
          <div className="space-y-2">
            {years.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
