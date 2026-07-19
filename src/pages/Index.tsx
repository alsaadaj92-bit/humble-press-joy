import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { GallerySidebar } from "@/components/gallery/Sidebar";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { Lightbox } from "@/components/gallery/Lightbox";
import { UploadFab } from "@/components/gallery/UploadFab";
import { SelectionToolbar } from "@/components/gallery/SelectionToolbar";
import { ProvidersPanel } from "@/components/gallery/ProvidersPanel";
import { SyncCenter } from "@/components/gallery/SyncCenter";
import { AlbumsPanel } from "@/components/gallery/AlbumsPanel";
import { MemoriesPanel } from "@/components/gallery/MemoriesPanel";
import { PlacesPanel } from "@/components/gallery/PlacesPanel";
import { DuplicatesPanel } from "@/components/gallery/DuplicatesPanel";
import { IdentityCard } from "@/components/gallery/IdentityCard";
import { BackupPanel } from "@/components/gallery/BackupPanel";
import { EncryptionPanel } from "@/components/gallery/EncryptionPanel";
import { SharingPanel } from "@/components/gallery/SharingPanel";
import { TopBar } from "@/components/gallery/TopBar";

import { SmartSearchPanel } from "@/components/gallery/SmartSearchPanel";
import { PeoplePanel } from "@/components/gallery/PeoplePanel";
import { OcrPanel } from "@/components/gallery/OcrPanel";

import { MobileNav } from "@/components/gallery/MobileNav";
import { TrashBanner } from "@/components/gallery/TrashBanner";
import { TimelineScrubber } from "@/components/gallery/TimelineScrubber";
import { AlbumPickerDialog } from "@/components/gallery/AlbumPickerDialog";
import { PwaStatus } from "@/components/gallery/PwaStatus";
import { CategoriesPanel } from "@/components/gallery/CategoriesPanel";
import { CreationsPanel } from "@/components/gallery/CreationsPanel";
import { DocumentScannerPanel } from "@/components/gallery/DocumentScannerPanel";

import { LockedFolderPanel } from "@/components/gallery/LockedFolderPanel";
import { SettingsPage } from "@/components/gallery/SettingsPage";
import { QuickChips } from "@/components/gallery/QuickChips";
import { LibraryHub } from "@/components/gallery/LibraryHub";
import { DensityToggle } from "@/components/gallery/DensityToggle";
import { useGridDensity } from "@/hooks/useGridDensity";
import { runViewTransition } from "@/lib/viewTransition";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { generateMockPhotos, type MockPhoto } from "@/lib/mockPhotos";
import { usePhotoStates } from "@/hooks/usePhotoStates";
import { useProviders } from "@/hooks/useProviders";
import { useMediaAssets } from "@/hooks/useMediaAssets";
import { useResolvedAssets } from "@/hooks/useResolvedAssets";
import { useSyncLoop } from "@/hooks/useSyncEngine";
import { useTrashSweeper } from "@/hooks/useTrashSweeper";
import { useAutoBackupLoop } from "@/hooks/useAutoBackup";
import { useAutoPipelineLoop } from "@/hooks/useAutoPipeline";
import { AutoPipelineConsent } from "@/components/gallery/AutoPipelineConsent";
import { AutoPipelineBadge } from "@/components/gallery/AutoPipelineBadge";
import { parseQuery, matchPhoto, describeQuery } from "@/lib/search";
import { buildTimelineBuckets } from "@/lib/timeline";

// Sections that fall back to "coming soon" placeholders.
const STUB_SECTIONS: Record<string, { title: string; body: string }> = {
  things: {
    title: "الأشياء",
    body: "تصنيف الصور حسب المحتوى (طعام، سيارات، حيوانات...) — سيصل قريباً باستخدام CLIP محلياً.",
  },
  starred: { title: "المميّزة بنجمة", body: "علامات نجوم مخصصة إلى جانب المفضلة — قريباً." },
  partner: { title: "مكتبة الشريك", body: "مشاركة كل مكتبتك تلقائياً مع شخص تثق به — قريباً." },
  print: { title: "متجر الطباعة", body: "طلب طباعة صورك على ورق أو كتاب — قريباً." },
};



const Index = () => {
  const mockPhotos = useMemo(() => generateMockPhotos(64), []);
  const [activeSection, setActiveSection] = useState("photos");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const { density, setDensity } = useGridDensity();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSelectedRef = useRef<string | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);

  const { states, setFavorite, setArchived, trash, restore } = usePhotoStates();
  const { providers } = useProviders();
  const assets = useMediaAssets();
  const uploadedPhotos = useResolvedAssets(assets, providers);
  useSyncLoop();
  useTrashSweeper();
  useAutoBackupLoop();
  useAutoPipelineLoop();


  // Uploaded assets first (newest), then mocks — sorted by date desc.
  const allPhotos = useMemo<MockPhoto[]>(() => {
    return [...uploadedPhotos, ...mockPhotos].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [uploadedPhotos, mockPhotos]);

  const parsedQuery = useMemo(() => parseQuery(query), [query]);
  const queryChips = useMemo(() => describeQuery(parsedQuery), [parsedQuery]);

  const visible = useMemo<MockPhoto[]>(() => {
    let list = allPhotos;
    list = list.filter((p) => {
      const s = states.get(p.id);
      const inTrash = !!s?.trashedAt;
      const isArchived = !!s?.archived;
      const isFavorite = !!s?.favorite;
      const isLocked = !!s?.locked;
      // Locked items only ever appear inside the Locked Folder section.
      if (isLocked && activeSection !== "locked") return false;
      switch (activeSection) {
        case "trash":
          return inTrash;
        case "archive":
          return isArchived && !inTrash;
        case "favorites":
          return isFavorite && !inTrash && !isArchived;
        case "locked":
          return isLocked && !inTrash;
        case "photos":
          return !inTrash && !isArchived;
        default:
          return !inTrash && !isArchived;
      }
    });
    if (query.trim()) {
      list = list.filter((p) => matchPhoto(p, parsedQuery, { states }));
    }
    return list;
  }, [allPhotos, query, parsedQuery, states, activeSection]);

  const timelineBuckets = useMemo(() => buildTimelineBuckets(visible), [visible]);
  const showScrubber =
    (activeSection === "photos" ||
      activeSection === "favorites" ||
      activeSection === "archive" ||
      activeSection === "trash") &&
    timelineBuckets.length >= 2;

  useEffect(() => {
    setSelection(new Set());
  }, [activeSection]);

  const toggleSelect = useCallback(
    (id: string, shift: boolean) => {
      setSelection((prev) => {
        const next = new Set(prev);
        if (shift && lastSelectedRef.current) {
          const ids = visible.map((p) => p.id);
          const a = ids.indexOf(lastSelectedRef.current);
          const b = ids.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(ids[i]);
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        lastSelectedRef.current = id;
        return next;
      });
    },
    [visible],
  );

  const selectedIds = useMemo(() => Array.from(selection), [selection]);
  const allSelectedFav = selectedIds.every((id) => states.get(id)?.favorite);

  const clearSelection = () => setSelection(new Set());
  const selectAll = () => setSelection(new Set(visible.map((p) => p.id)));

  const doFavorite = () => {
    if (!selectedIds.length) return;
    setFavorite(selectedIds, !allSelectedFav);
    toast.success(allSelectedFav ? "أُزيلت من المفضلة" : "أُضيفت للمفضلة");
  };
  const doArchive = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const wasArchive = activeSection === "archive";
    setArchived(ids, !wasArchive);
    toast.success(wasArchive ? "أُخرجت من الأرشيف" : "أُرشفت", {
      action: { label: "تراجع", onClick: () => setArchived(ids, wasArchive) },
    });
    clearSelection();
  };
  const doTrash = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    trash(ids);
    toast.success("نُقلت لسلة المحذوفات", {
      action: { label: "تراجع", onClick: () => restore(ids) },
    });
    clearSelection();
  };
  const doRestore = () => {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    restore(ids);
    toast.success("استُعيدت الصور", {
      action: { label: "تراجع", onClick: () => trash(ids) },
    });
    clearSelection();
  };
  const doLock = async () => {
    if (!selectedIds.length) return;
    const { setPhotoStates } = await import("@/lib/photoDb");
    await setPhotoStates(selectedIds, { locked: true });
    toast.success("نُقلت للمجلد المؤمَّن");
    clearSelection();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      if (lightboxIndex !== null) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (selection.size) clearSelection();
        return;
      }
      if (!selection.size) return;
      if (e.key === "f" || e.key === "F") doFavorite();
      else if (e.key === "e" || e.key === "E") doArchive();
      else if (e.key === "Delete" || e.key === "Backspace") doTrash();
      else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        selectAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, visible, lightboxIndex, activeSection]);

  const sectionMeta: Record<string, { title: string; sub: (n: number) => string }> = {
    photos: {
      title: "الصور",
      sub: (n) =>
        `${n} صورة · ${uploadedPhotos.length} منها مرفوعة عبر مزودك` ,
    },
    favorites: { title: "المفضلة", sub: (n) => `${n} صورة مميّزة` },
    archive: { title: "الأرشيف", sub: (n) => `${n} صورة مؤرشفة` },
    trash: { title: "سلة المحذوفات", sub: (n) => `${n} عنصر · تُحذف تلقائياً بعد 30 يوماً` },
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <PwaStatus />
      <GallerySidebar
        active={activeSection}
        onSelect={setActiveSection}
        onSearchClick={() => setSearchOpen(true)}
      />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <GallerySidebar
            embedded
            active={activeSection}
            onSelect={(id) => {
              setActiveSection(id);
              setDrawerOpen(false);
            }}
            onSearchClick={() => {
              setDrawerOpen(false);
              setSearchOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      <main ref={mainScrollRef} className="scrollbar-thin relative flex-1 overflow-y-auto pb-20 md:pb-0">
        {showScrubber && (
          <TimelineScrubber buckets={timelineBuckets} scrollRef={mainScrollRef} />
        )}
        <TopBar
          query={query}
          onQueryChange={setQuery}
          searchInputRef={searchInputRef}
          onOpenDrawer={() => setDrawerOpen(true)}
          onSelectSection={setActiveSection}
        />
        <div className="pointer-events-none absolute right-4 top-14 z-30 md:top-16">
          <div className="pointer-events-auto"><AutoPipelineBadge /></div>
        </div>
        <AutoPipelineConsent />
        {queryChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border bg-background/60 px-4 py-2 md:px-8">
            {queryChips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="min-w-0 flex-1">
            <QuickChips active={activeSection} onSelect={setActiveSection} />
          </div>
          <div className="shrink-0 pl-2 pr-4 md:pr-8">
            <DensityToggle density={density} onChange={setDensity} />
          </div>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8">
          {selection.size > 0 && (
            <SelectionToolbar
              count={selection.size}
              section={activeSection}
              onClear={clearSelection}
              onFavorite={doFavorite}
              onArchive={doArchive}
              onTrash={doTrash}
              onRestore={doRestore}
              onSelectAll={selectAll}
              onAddToAlbum={() => setPickerOpen(true)}
              onLock={doLock}
            />
          )}


          {sectionMeta[activeSection] && (
            <>
              <SectionHero
                title={sectionMeta[activeSection].title}
                subtitle={sectionMeta[activeSection].sub(visible.length)}
              />
              {activeSection === "trash" && (
                <TrashBanner
                  photos={visible}
                  states={states}
                  onRestoreAll={(ids) => {
                    restore(ids);
                    clearSelection();
                  }}
                />
              )}
              <PhotoGrid
                photos={visible}
                onOpen={(i) => runViewTransition(() => setLightboxIndex(i))}
                states={states}
                selection={selection}
                onToggleSelect={toggleSelect}
                onSelectionChange={(ids) => setSelection(new Set(ids))}
                activeId={lightboxIndex != null ? visible[lightboxIndex]?.id ?? null : null}
                section={activeSection}
                query={query}
                density={density}
                onFavoriteToggle={(id) => {
                  const cur = !!states.get(id)?.favorite;
                  setFavorite([id], !cur);
                }}
              />
            </>
          )}

          {activeSection === "memories" && (
            <>
              <SectionHero
                title="الذكريات"
                subtitle="لحظات مختارة من مكتبتك — تُبنى محلياً بدون أي خادم"
              />
              <MemoriesPanel photos={allPhotos} />
            </>
          )}
          {activeSection === "places" && (
            <>
              <SectionHero
                title="الأماكن"
                subtitle="صورك على الخريطة — الإحداثيات تُقرأ من EXIF محلياً فقط"
              />
              <PlacesPanel photos={allPhotos} states={states} />
            </>
          )}
          {activeSection === "smart" && (
            <>
              <SectionHero
                title="البحث الذكي المحلي"
                subtitle="ابحث في صورك بالوصف الطبيعي — CLIP يعمل داخل متصفحك، بدون إرسال أي صورة"
              />
              <SmartSearchPanel photos={allPhotos} states={states} onOpen={setLightboxIndex} />
            </>
          )}
          {activeSection === "people" && (
            <>
              <SectionHero
                title="الأشخاص"
                subtitle="تعرّف على الوجوه ويجمّعها محلياً — بدون أي إرسال للسحابة"
              />
              <PeoplePanel photos={allPhotos} onOpen={setLightboxIndex} />
            </>
          )}
          {activeSection === "ocr" && (
            <>
              <SectionHero
                title="قراءة النصوص من الصور"
                subtitle="استخرج النص العربي/الإنجليزي محلياً من لقطات الشاشة والإيصالات — بدون سحابة"
              />
              <OcrPanel photos={allPhotos} onOpen={setLightboxIndex} />
            </>
          )}

          {(activeSection === "categories" ||
            activeSection === "videos" ||
            activeSection === "selfies" ||
            activeSection === "screenshots" ||
            activeSection === "documents") && (
            <>
              <SectionHero
                title="التصنيفات"
                subtitle="فرز تلقائي محلي: فيديوهات، سيلفي، لقطات شاشة، ومستندات — بدون أي إرسال للسحابة"
              />
              <CategoriesPanel photos={allPhotos} states={states} onOpen={setLightboxIndex} />
            </>
          )}

          {activeSection === "creations" && (
            <>
              <SectionHero
                title="أفلام ومجمّعات"
                subtitle="أنشئ مجمّعات وأفلاماً قصيرة ومتحركات من صورك — كل شيء يُبنى داخل متصفحك، بدون أي رفع"
              />
              <CreationsPanel photos={allPhotos} />
            </>
          )}

          {activeSection === "scanner" && (
            <>
              <SectionHero
                title="ماسح المستندات"
                subtitle="التقط الأوراق والإيصالات، صحّح المنظور، وصدّرها PDF — كل شيء داخل متصفحك بدون رفع"
              />
              <DocumentScannerPanel />
            </>
          )}


          {activeSection === "locked" && (
            <>
              <SectionHero
                title="المجلد المؤمَّن"
                subtitle="صور محمية برمز PIN محلي — لا تظهر في البحث ولا الذكريات ولا أي قسم آخر"
              />
              <LockedFolderPanel photos={allPhotos} states={states} onOpen={setLightboxIndex} />
            </>
          )}




          {activeSection === "library" && (
            <>
              <SectionHero
                title="المكتبة"
                subtitle="كل مجموعاتك وأدواتك في مكان واحد — على غرار Google Photos"
              />
              <LibraryHub onNavigate={setActiveSection} />
            </>
          )}
          {activeSection === "albums" && <AlbumsPanel />}
          {activeSection === "duplicates" && (
            <>
              <SectionHero
                title="التكرارات"
                subtitle="اكتشاف الصور المكررة محلياً باستخدام الحجم وEXIF واسم الملف"
              />
              <DuplicatesPanel photos={allPhotos} states={states} />
            </>
          )}
          {activeSection === "providers" && <ProvidersPanel />}
          {activeSection === "sync" && <SyncCenter />}
          {activeSection === "sharing" && (
            <>
              <SectionHero
                title="المشاركة"
                subtitle="مجموعات مشاركة محلية، ورموز نقل بين أجهزتك، ومشاركة عبر تطبيقات النظام — دون سحابة"
              />
              <SharingPanel />
            </>
          )}

          {STUB_SECTIONS[activeSection] && (
            <PlaceholderSection
              title={STUB_SECTIONS[activeSection].title}
              body={STUB_SECTIONS[activeSection].body}
            />
          )}

          {activeSection === "settings" && (
            <SettingsPage onNavigate={setActiveSection} />
          )}
        </div>
      </main>

      <UploadFab />
      <MobileNav active={activeSection} onSelect={setActiveSection} />

      <Lightbox
        photos={visible}
        index={lightboxIndex}
        onClose={() => runViewTransition(() => setLightboxIndex(null))}
        onIndexChange={setLightboxIndex}
      />

      <AlbumPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assetIds={selectedIds}
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
              اضغط Escape للإغلاق. البحث الدلالي بـ CLIP سيتوفر في خطوة الذكاء الاصطناعي.
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
