import { Heart, Archive, Trash2, X, RotateCcw, CheckSquare, FolderPlus } from "lucide-react";

interface Props {
  count: number;
  section: string;
  onClear: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onSelectAll: () => void;
  onAddToAlbum?: () => void;
}

export function SelectionToolbar({
  count,
  section,
  onClear,
  onFavorite,
  onArchive,
  onTrash,
  onRestore,
  onSelectAll,
  onAddToAlbum,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <button
        onClick={onClear}
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label="إلغاء التحديد"
      >
        <X className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold">{count} محدد</span>

      <button
        onClick={onSelectAll}
        className="mr-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <CheckSquare className="h-4 w-4" />
        تحديد الكل
      </button>

      <div className="mr-auto flex items-center gap-1">
        {section !== "trash" && (
          <>
            {onAddToAlbum && (
              <IconAction icon={FolderPlus} label="إضافة إلى ألبوم" onClick={onAddToAlbum} />
            )}
            <IconAction icon={Heart} label="مفضلة (F)" onClick={onFavorite} />
            <IconAction icon={Archive} label="أرشيف (E)" onClick={onArchive} />
            <IconAction icon={Trash2} label="حذف (Del)" onClick={onTrash} destructive />
          </>
        )}
        {section === "trash" && (
          <>
            <IconAction icon={RotateCcw} label="استعادة" onClick={onRestore} />
            <IconAction icon={Trash2} label="حذف نهائي" onClick={onTrash} destructive />
          </>
        )}
      </div>
    </div>
  );
}


function IconAction({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition hover:bg-accent " +
        (destructive
          ? "text-destructive hover:text-destructive"
          : "text-foreground")
      }
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
