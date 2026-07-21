import { useState } from "react";
import {
  Menu,
  Search,
  Plus,
  HelpCircle,
  Settings2,
  UserCircle2,
  LibraryBig,
  Users,
  Film,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  searchInputRef?: React.Ref<HTMLInputElement>;
  onOpenDrawer: () => void;
  onSelectSection: (id: string) => void;
}

/**
 * Google Photos-style header:
 *   [menu] [search................] [cast] [+ create] [help] [settings] [avatar]
 */
export function TopBar({
  query,
  onQueryChange,
  searchInputRef,
  onOpenDrawer,
  onSelectSection,
}: TopBarProps) {
  const stub = (label: string) => toast.message(`${label} — قريباً`);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/85 px-2 py-2 backdrop-blur md:px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}>
      <button
        className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
        aria-label="القائمة"
        onClick={onOpenDrawer}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5 md:mx-4 md:max-w-2xl">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="ابحث في الصور"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mr-auto flex items-center gap-1">


        <CreateMenu onSelectSection={onSelectSection} stub={stub} />

        <IconBtn label="مساعدة" onClick={() => stub("المساعدة")}>
          <HelpCircle className="h-5 w-5" />
        </IconBtn>

        <IconBtn
          label="إعدادات"
          onClick={() => onSelectSection("settings")}
        >
          <Settings2 className="h-5 w-5" />
        </IconBtn>

        <AccountButton onSelectSection={onSelectSection} stub={stub} />
      </div>
    </header>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="hidden h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:grid"
    >
      {children}
    </button>
  );
}

function CreateMenu({
  onSelectSection,
  stub,
}: {
  onSelectSection: (id: string) => void;
  stub: (l: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:h-10 md:w-auto md:gap-2 md:px-3"
          aria-label="إنشاء"
          title="إنشاء"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden text-sm md:inline">إنشاء</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>إنشاء جديد</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelectSection("albums")}>
          <LibraryBig className="ml-2 h-4 w-4" /> ألبوم
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("ألبوم مشترك")}>
          <Users className="ml-2 h-4 w-4" /> ألبوم مشترك
          <StubTag />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("فيلم")}>
          <Film className="ml-2 h-4 w-4" /> فيلم
          <StubTag />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("رسم متحرك")}>
          <Sparkles className="ml-2 h-4 w-4" /> رسم متحرك
          <StubTag />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("مجمّع صور")}>
          <LayoutGrid className="ml-2 h-4 w-4" /> مجمّع (Collage)
          <StubTag />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountButton({
  onSelectSection,
  stub,
}: {
  onSelectSection: (id: string) => void;
  stub: (l: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="الحساب"
          className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary transition hover:bg-primary/25"
        >
          <UserCircle2 className="h-6 w-6" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>الحساب المحلي</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelectSection("settings")}>
          الهوية والإعدادات
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectSection("providers")}>
          مزودو التخزين
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectSection("sync")}>
          حالة المزامنة
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => stub("تبديل الحساب")}>
          تبديل الحساب <StubTag />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stub("تسجيل خروج")}>
          تسجيل خروج <StubTag />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StubTag() {
  return (
    <span className="mr-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
      قريباً
    </span>
  );
}
