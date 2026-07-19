import { useMemo, useState } from "react";
import { Check, FolderPlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAlbums } from "@/hooks/useAlbums";
import { useAlbumMemberIndex } from "@/hooks/useAlbumMembers";
import { addAssetsToAlbum, createManualAlbum } from "@/lib/manualAlbums";

interface Props {
  open: boolean;
  onClose: () => void;
  assetIds: string[];
}

export function AlbumPickerDialog({ open, onClose, assetIds }: Props) {
  const albums = useAlbums();
  const memberIndex = useAlbumMemberIndex();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const manual = useMemo(
    () => albums.filter((a) => a.kind === "manual"),
    [albums],
  );

  if (!open) return null;

  const addTo = async (albumId: string, label: string) => {
    if (!assetIds.length) return;
    setBusy(albumId);
    try {
      await addAssetsToAlbum(albumId, assetIds);
      toast.success(`أُضيفت ${assetIds.length} عنصر إلى «${label}»`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت الإضافة");
    } finally {
      setBusy(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy("__new__");
    try {
      const a = await createManualAlbum(name);
      await addAssetsToAlbum(a.id, assetIds);
      toast.success(`أُنشئ «${a.name}» وأُضيف ${assetIds.length} عنصر`);
      setNewName("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">إضافة إلى ألبوم</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            placeholder="ألبوم جديد..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={createAndAdd}
            disabled={!newName.trim() || busy === "__new__"}
            className="btn-primary text-xs disabled:opacity-40"
          >
            {busy === "__new__" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" />
            )}
            <span>إنشاء</span>
          </button>
        </div>

        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {manual.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              لا توجد ألبومات يدوية بعد.
            </p>
          )}
          {manual.map((a) => {
            const members = memberIndex.get(a.id);
            const already = assetIds.every((id) => members?.has(id));
            return (
              <button
                key={a.id}
                onClick={() => !already && addTo(a.id, a.name)}
                disabled={already || busy === a.id}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right transition hover:bg-accent disabled:opacity-60"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <FolderPlus className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-sm">{a.name}</span>
                {already ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : busy === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {members?.size ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
