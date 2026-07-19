import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { Loader2, Scan, UserRound, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { photoDb, type FaceRow, type PersonRow } from "@/lib/photoDb";
import {
  detectFacesInImage,
  hidePerson,
  loadFaceModels,
  rebuildPersons,
  renamePerson,
  saveDetectedFaces,
} from "@/lib/faces";
import type { MockPhoto } from "@/lib/mockPhotos";
import { cn } from "@/lib/utils";

interface Props {
  photos: MockPhoto[];
  onOpen?: (index: number) => void;
}

export function PeoplePanel({ photos }: Props) {
  const [faces, setFaces] = useState<FaceRow[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [modelReady, setModelReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);

  useEffect(() => {
    const s1 = liveQuery(() => photoDb.faces.toArray()).subscribe({ next: setFaces });
    const s2 = liveQuery(() =>
      photoDb.persons.orderBy("updatedAt").reverse().toArray(),
    ).subscribe({ next: setPersons });
    return () => {
      s1.unsubscribe();
      s2.unsubscribe();
    };
  }, []);

  const facesByAsset = useMemo(() => {
    const m = new Map<string, FaceRow[]>();
    for (const f of faces) {
      const arr = m.get(f.assetId) ?? [];
      arr.push(f);
      m.set(f.assetId, arr);
    }
    return m;
  }, [faces]);

  const facesByPerson = useMemo(() => {
    const m = new Map<string, FaceRow[]>();
    for (const f of faces) {
      if (!f.personId) continue;
      const arr = m.get(f.personId) ?? [];
      arr.push(f);
      m.set(f.personId, arr);
    }
    return m;
  }, [faces]);

  const photosById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  // Only scan uploaded / local photos that have a resolvable URL.
  const scannable = useMemo(
    () => photos.filter((p) => p.thumbSrc || p.fullSrc),
    [photos],
  );
  const unscanned = useMemo(
    () => scannable.filter((p) => !facesByAsset.has(p.id)),
    [scannable, facesByAsset],
  );

  const prepareModel = async () => {
    setLoadingModel(true);
    try {
      await loadFaceModels();
      setModelReady(true);
      toast.success("جاهز — نموذج التعرف على الوجوه محمّل محلياً");
    } catch (e) {
      toast.error("تعذّر تحميل النموذج", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingModel(false);
    }
  };

  const scan = async () => {
    if (!unscanned.length) {
      toast.info("لا توجد صور جديدة للفحص");
      return;
    }
    setScanning(true);
    setProgress({ done: 0, total: unscanned.length });
    try {
      await loadFaceModels();
      setModelReady(true);
      for (let i = 0; i < unscanned.length; i++) {
        const p = unscanned[i];
        const url = p.fullSrc ?? p.thumbSrc;
        if (!url) continue;
        try {
          const rows = await detectFacesInImage(p.id, url);
          await saveDetectedFaces(rows);
        } catch (err) {
          console.warn("face scan failed for", p.id, err);
        }
        setProgress({ done: i + 1, total: unscanned.length });
      }
      await rebuildPersons();
      toast.success("اكتمل الفحص وتم تجميع الأشخاص");
    } catch (e) {
      toast.error("توقف الفحص", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setScanning(false);
    }
  };

  const recluster = async () => {
    try {
      await rebuildPersons();
      toast.success("أُعيد تجميع الأشخاص");
    } catch (e) {
      toast.error("فشل التجميع", { description: String(e) });
    }
  };

  const doRename = async (p: PersonRow) => {
    const name = window.prompt("اسم الشخص:", p.name ?? "");
    if (name === null) return;
    await renamePerson(p.id, name);
  };

  const total = faces.length;
  const named = persons.filter((p) => p.name).length;
  const visiblePersons = persons.filter((p) => !p.hidden);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div
        className="rounded-2xl border border-border p-5"
        style={{ background: "var(--gradient-hero)" }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserRound className="h-6 w-6" />
          الأشخاص
        </h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          يُشغَّل نموذج التعرف على الوجوه بالكامل داخل متصفحك (face-api / TFJS).
          الصور والأوصاف الرقمية لا تُرسل لأي خادم — تُخزَّن محلياً فقط.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">
            {total} وجه مكتشف
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1">
            {visiblePersons.length} شخص · {named} مسمّى
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1">
            {unscanned.length} صورة غير مفحوصة
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!modelReady && (
            <button
              onClick={prepareModel}
              disabled={loadingModel}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              {loadingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              تحميل النموذج
            </button>
          )}
          <button
            onClick={scan}
            disabled={scanning || !unscanned.length}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
            فحص الصور ({unscanned.length})
          </button>
          <button
            onClick={recluster}
            disabled={scanning || !total}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            إعادة التجميع
          </button>
        </div>

        {scanning && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {visiblePersons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          لا يوجد أشخاص بعد. ارفع صوراً ثم اضغط "فحص الصور".
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePersons
            .sort((a, b) => (facesByPerson.get(b.id)?.length ?? 0) - (facesByPerson.get(a.id)?.length ?? 0))
            .map((p) => {
              const clusterFaces = facesByPerson.get(p.id) ?? [];
              const cover = clusterFaces.find((f) => f.id === p.coverFaceId) ?? clusterFaces[0];
              const coverPhoto = cover ? photosById.get(cover.assetId) : null;
              const coverUrl = coverPhoto?.thumbSrc ?? coverPhoto?.fullSrc;
              return (
                <div
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="relative aspect-square bg-secondary">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={p.name ?? "شخص"}
                        className="h-full w-full object-cover"
                        style={
                          cover
                            ? ({
                                objectPosition: `${Math.round(
                                  ((cover.box.x + cover.box.width / 2) / (coverPhoto?.width || 1)) *
                                    100,
                                )}% ${Math.round(
                                  ((cover.box.y + cover.box.height / 2) / (coverPhoto?.height || 1)) *
                                    100,
                                )}%`,
                              } as any)
                            : undefined
                        }
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <UserRound className="h-10 w-10" />
                      </div>
                    )}
                    <button
                      onClick={() => hidePerson(p.id, true)}
                      className="absolute top-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                      title="إخفاء"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", !p.name && "text-muted-foreground")}>
                        {p.name ?? "بدون اسم"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {clusterFaces.length} صورة
                      </p>
                    </div>
                    <button
                      onClick={() => doRename(p)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      title="تسمية"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {persons.some((p) => p.hidden) && (
        <button
          onClick={async () => {
            for (const p of persons.filter((x) => x.hidden)) await hidePerson(p.id, false);
          }}
          className="btn-secondary text-xs mx-auto flex items-center gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" />
          إظهار المخفيين ({persons.filter((p) => p.hidden).length})
        </button>
      )}
    </div>
  );
}
