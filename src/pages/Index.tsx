import { useMemo, useState } from "react";
import { Menu, Search } from "lucide-react";
import { GallerySidebar } from "@/components/gallery/Sidebar";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { Lightbox } from "@/components/gallery/Lightbox";
import { UploadFab } from "@/components/gallery/UploadFab";
import { generateMockPhotos } from "@/lib/mockPhotos";

const Index = () => {
  const photos = useMemo(() => generateMockPhotos(64), []);
  const [activeSection, setActiveSection] = useState("photos");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return photos;
    const q = query.trim().toLowerCase();
    return photos.filter((p) => p.name.toLowerCase().includes(q));
  }, [photos, query]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <GallerySidebar
        active={activeSection}
        onSelect={setActiveSection}
        onSearchClick={() => setSearchOpen(true)}
      />

      <main className="scrollbar-thin relative flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <button
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
            aria-label="القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الملف..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              وضع خاص · بدون سحابة
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="px-4 py-6 md:px-8 md:py-8">
          {activeSection === "photos" && (
            <>
              <SectionHero
                title="الصور"
                subtitle={`${filtered.length} صورة · مرتبة حسب التاريخ`}
              />
              <PhotoGrid photos={filtered} onOpen={setLightboxIndex} />
            </>
          )}

          {activeSection === "albums" && (
            <PlaceholderSection
              title="الألبومات"
              body="سيتم تفعيل الألبومات في المرحلة الثانية بعد ربط مزود التخزين."
            />
          )}

          {activeSection === "providers" && (
            <PlaceholderSection
              title="مزودو التخزين"
              body="ستضيف هنا إعدادات تيليجرام والخادم المحلي و File System API في المرحلة الثانية."
            />
          )}

          {activeSection === "settings" && (
            <PlaceholderSection
              title="الإعدادات"
              body="تفضيلات العرض، الضغط، والاستخراج التلقائي لبيانات EXIF ستظهر هنا لاحقاً."
            />
          )}
        </div>
      </main>

      <UploadFab />

      <Lightbox
        photos={filtered}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />

      {searchOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-24 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في صورك..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="mt-3 px-2 text-xs text-muted-foreground">
              اضغط Escape للإغلاق. البحث المتقدم بالتاريخ والوسم سيتوفر لاحقاً.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

function SectionHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="mb-6 rounded-2xl border border-border p-5"
      style={{ background: "var(--gradient-hero)" }}
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PlaceholderSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default Index;
