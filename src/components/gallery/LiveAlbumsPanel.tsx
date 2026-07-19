import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useLiveAlbums } from "@/hooks/useLiveAlbums";
import { usePhotoStates } from "@/hooks/usePhotoStates";
import {
  describeRule,
  evaluate,
  type LiveAlbum,
  type LiveRule,
  type LiveRuleKind,
} from "@/lib/liveAlbums";
import type { MockPhoto } from "@/lib/mockPhotos";

interface Props {
  photos: MockPhoto[];
  onOpen?: (globalIndex: number) => void;
}

const RULE_KINDS: { id: LiveRuleKind; label: string; needsValue?: "number" | "text" | "month" }[] = [
  { id: "favorite", label: "مفضلة" },
  { id: "has-gps", label: "بها GPS" },
  { id: "kind-video", label: "فيديو" },
  { id: "kind-image", label: "صورة ثابتة" },
  { id: "year", label: "سنة", needsValue: "number" },
  { id: "month", label: "شهر", needsValue: "month" },
  { id: "camera", label: "كاميرا (نص)", needsValue: "text" },
  { id: "name-contains", label: "الاسم يحوي", needsValue: "text" },
];

export function LiveAlbumsPanel({ photos, onOpen }: Props) {
  const { albums, save } = useLiveAlbums();
  const { states } = usePhotoStates();
  const [creating, setCreating] = useState(false);

  const matchesFor = useMemo(() => {
    const out = new Map<string, MockPhoto[]>();
    for (const a of albums) {
      out.set(
        a.id,
        photos.filter((p) => evaluate(p, states.get(p.id), a.rules)),
      );
    }
    return out;
  }, [albums, photos, states]);

  const addAlbum = async (a: LiveAlbum) => {
    await save([...albums, a]);
    toast.success(`أضيف ألبوم حي: ${a.name}`);
  };

  const removeAlbum = async (id: string) => {
    await save(albums.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" />
          الألبومات الحية
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          تُعرَّف بمجموعة قواعد وتُحدَّث تلقائياً كلما أضفت صوراً أو غيّرت المفضلة —
          كل التقييم يجري محلياً داخل متصفحك.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          ألبوم حي جديد
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((a) => {
          const matches = matchesFor.get(a.id) ?? [];
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">
                    <span className="mr-1">{a.emoji ?? "✨"}</span>
                    {a.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.rules.map((r, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {describeRule(r)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => removeAlbum(a.id)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                {matches.length} عنصر
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1">
                {matches.slice(0, 8).map((p) => {
                  const globalIdx = photos.indexOf(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => globalIdx >= 0 && onOpen?.(globalIdx)}
                      className="aspect-square overflow-hidden rounded-md bg-secondary"
                    >
                      <img
                        src={p.thumbSrc ?? `https://picsum.photos/seed/${p.seed}/200`}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
                {matches.length === 0 && (
                  <div className="col-span-4 rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    لا توجد نتائج بعد
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateDialog
          onCancel={() => setCreating(false)}
          onCreate={async (a) => {
            await addAlbum(a);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (a: LiveAlbum) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [rules, setRules] = useState<LiveRule[]>([]);
  const [kind, setKind] = useState<LiveRuleKind>("favorite");
  const [value, setValue] = useState<string>("");

  const meta = RULE_KINDS.find((k) => k.id === kind)!;

  const addRule = () => {
    const rule: LiveRule =
      meta.needsValue === "number"
        ? { kind, value: Number(value) || 0 }
        : meta.needsValue
          ? { kind, value }
          : { kind };
    setRules([...rules, rule]);
    setValue("");
  };

  const submit = () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    if (!rules.length) return toast.error("أضف قاعدة واحدة على الأقل");
    const now = Date.now();
    onCreate({
      id: `live-${now}`,
      name: name.trim(),
      emoji,
      rules,
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            ألبوم حي جديد
          </h3>
          <button onClick={onCancel} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-[auto,1fr] gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
            className="w-14 rounded-lg bg-secondary px-3 py-2 text-center text-lg"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الألبوم"
            className="rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">
            القواعد (تُطبَّق جميعها معاً)
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {rules.map((r, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs text-primary"
              >
                {describeRule(r)}
                <button
                  onClick={() => setRules(rules.filter((_, j) => j !== i))}
                  className="rounded-full hover:bg-primary/30"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {rules.length === 0 && (
              <span className="text-xs text-muted-foreground">لا قواعد بعد</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as LiveRuleKind)}
              className="rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
            >
              {RULE_KINDS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
            {meta.needsValue === "number" && (
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="مثلاً 2024"
                className="w-32 rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
              />
            )}
            {meta.needsValue === "month" && (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
              >
                <option value="">-- شهر --</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            {meta.needsValue === "text" && (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="نص"
                className="rounded-lg bg-secondary px-3 py-2 text-sm outline-none"
              />
            )}
            <button
              onClick={addRule}
              disabled={meta.needsValue && !value}
              className="rounded-full bg-secondary px-3 py-2 text-xs disabled:opacity-50"
            >
              + قاعدة
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full bg-secondary px-4 py-2 text-sm"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            إنشاء
          </button>
        </div>
      </div>
    </div>
  );
}
