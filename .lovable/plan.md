
# خطة إعادة الهيكلة: تطبيق مزامنة صور تليكرام فقط

## الفكرة النهائية
تطبيق واحد بثلاث شاشات:
1. **للمزامنة** — الصور المستوردة من الاستوديو التي لم تُرفع بعد للتليكرام.
2. **معرض تليكرام** — يقرأ الصور مباشرة من مجموعتك عبر Telegram Bot API ويعرضها كمعرض حقيقي.
3. **الإعدادات** — بوت التليكرام + الشات + وضع المزامنة.

كل شيء آخر يُحذف من الواجهة والكود.

---

## 1. الحذف الكامل

### مكوّنات تُحذف من المشروع
- OCR: `OcrPanel`, `lib/ocr.ts`, `ocr.test.ts`, تبعية `tesseract.js`.
- بحث دلالي CLIP: `SmartSearchPanel`, `lib/semantic.ts` + test, `lib/preloadModels.ts`, تبعية `@xenova/transformers`.
- الوجوه: `PeoplePanel`, `FaceSettingsPanel`, `lib/faces.ts`, `lib/faceCluster.ts` + tests, تبعية `@mediapipe/tasks-vision`.
- الذكريات: `MemoriesPanel`, `lib/memories.ts` + `highlights.ts`.
- الأماكن: `PlacesPanel`, `lib/places.ts` + test, `MiniMap.tsx`.
- المكررات: `DuplicatesPanel`, `lib/duplicates.ts` + test.
- الألبومات: `AlbumsPanel`, `LiveAlbumsPanel`, `AlbumPickerDialog`, `CategoriesPanel`, `CreationsPanel`, `lib/albums.ts`, `manualAlbums.ts`, `liveAlbums.ts`, `categories.ts`, `creations.ts`, `shareCollections.ts`, `share.ts`.
- التشفير + المجلد المقفل: `EncryptionPanel`, `LockedFolderPanel`, `lib/crypto.ts`, `lib/lockedFolder.ts`.
- محرر/إيريزر: `PhotoEditor`, `MagicEraserPanel`, `DocumentScannerPanel`, `lib/imageEditor.ts`, `magicEraser.ts`, `documentScanner.ts`.
- Auto-pipeline: `AutoPipelineBadge`, `AutoPipelineConsent`, `useAutoPipeline`, `lib/autoPipeline.ts`, `useAutoBackup`, `autoBackup.ts`, `backup.ts`, `BackupPanel`.
- خدمات مساعدة لم تعد تُستخدم: `serverCode.ts`, `providers/localServer*.ts`, `useResolvedAssets` (يبقى إن لزم للعرض)، `chunker.ts`، `compress.ts` (يبقى إن استخدمنا الضغط عند الرفع)، `useTrashSweeper`، `TrashBanner`، `TimelineScrubber`، `QuickChips`، `LibraryHub`، `AdvancedToolsHub`، `SharingPanel`، `TopicRulesPanel` + `useTopicRules` + `topicRouting.ts`.
- MCP tools ما عدا `send-telegram-photo`.

### Dexie schema (bump v6)
تُحذف الجداول: `photoStates` (نُبقيها فقط لعلامة "isFavorite" اختيارياً — أو نحذفها كلها)، `topicRules`, `albums`, `albumMembers`.  
تبقى: `providers`, `assets`, `syncJobs`, `kv`.  
نضيف على `assets`: حقل `syncedAt?: number` + فهرس `[provider+syncedAt]`.

### فلترة "للمزامنة"
الشاشة الرئيسية تعرض فقط: `assets` حيث `provider === 'device'` و `syncedAt` غير مُعرّف.  
بعد رفع ناجح لكل asset يضع `syncEngine` `syncedAt = Date.now()` و `remoteFileId` — يختفي من القائمة تلقائياً.

---

## 2. الاستيراد (يبقى)
- يستخدم `Camera.pickImages({ limit: 0 })` (يعمل حالياً).
- زر واحد "استيراد صور" في أعلى شاشة "للمزامنة".
- في المتصفح: `<input type="file" webkitdirectory multiple>` لدعم اختيار مجلد كامل.
- Capacitor يترجم `Camera.pickImages` إلى Android `ACTION_PICK` مع `EXTRA_ALLOW_MULTIPLE` وأذونات `READ_MEDIA_IMAGES` — مُهيّأ فعلاً في `AndroidManifest` عبر البلجن.

---

## 3. المزامنة للتليكرام
- `syncEngine` يبقى لكن مبسّطاً: يقرأ `assets` غير المتزامنة، يرفعها عبر `telegramSendDocument`، يحدّث `syncedAt` و `remoteFileId` و `remoteMessageId`.
- إعدادات مبسّطة: تلقائي/يدوي فقط + Wi-Fi only toggle.
- زر "مزامنة الآن" بارز + شريط تقدم حي في الأعلى.

---

## 4. عارض التليكرام (جديد)
شاشة `TelegramGallery`:
- عند الفتح تستدعي `getUpdates` بشكل متكرر (long-poll offset مخزّن في `kv`) لبناء فهرس محلي في `assets` بعلامة `provider: 'telegram-remote'` مع `fileId`, `date`, `width/height` من الرد.
- كل رسالة تحوي photo أو document (image/video) تُضاف. التكرار يُتجاهل عبر `fileId`.
- الشبكة (masonry) نفس `PhotoGrid` (نُعيد استخدامه).
- عند فتح صورة: `getFile` → `telegramFileUrl` → عرضها كاملة الحجم في Lightbox.
- زر تنزيل: يجلب البلوب ويستخدم Capacitor Filesystem (على Android) أو `<a download>` على الويب.

Long-poll يمشي في الخلفية داخل hook `useTelegramFeed` مع debounce لتجنّب إفراط الطلبات.

---

## 5. الانتقالات (shared-element + swipe + pinch-zoom)
- الشبكة تُضيف `style={{ viewTransitionName: 'photo-'+id }}` على البلاطة النشطة.
- الـ Lightbox يضع نفس الاسم على `<img>` الرئيسية.
- الفتح/الإغلاق داخل `runViewTransition()` (موجود).
- Lightbox جديد مبني على swipeable horizontal snap (`overflow-x snap-x`) + `ZoomableImage` (موجود) للـ pinch/pan.
- على Android يعمل View Transitions API عبر WebView Chromium الحديث؛ fallback: `animate-fade-in`.

---

## 6. التنقل النهائي
`MobileNav` بتبويبتين فقط: **للمزامنة** و **معرض تليكرام**، + أيقونة إعدادات في أعلى الشاشة.  
`Sidebar` يختفي (لا معنى له بتبويبتين).

---

## 7. البنية النهائية للملفات
```text
src/
  pages/Index.tsx                → Router بين tab=sync | tab=telegram | settings
  components/gallery/
    SyncScreen.tsx               → قائمة "للمزامنة" + زر استيراد + زر مزامنة
    TelegramScreen.tsx           → عارض التليكرام
    PhotoGrid.tsx                → مُبسّط (بلا favorite/select toolbar)
    Lightbox.tsx                 → swipe + pinch + shared element
    UploadFab.tsx                → مُبسّط لاستيراد فقط
    SettingsPage.tsx             → بوت + شات + وضع المزامنة فقط
    MobileNav.tsx                → تبويبتان
    SyncCenter.tsx               → داخل SettingsPage كقسم
    ProvidersPanel.tsx           → داخل SettingsPage كقسم
    PermissionsWizard.tsx        → يبقى (Android)
    DiagnosticsPanel.tsx         → يبقى مخفي في الإعدادات
  hooks/
    useMediaAssets.ts            → يقبل filter (unsynced | telegram)
    useTelegramFeed.ts           → جديد
    useSyncEngine.ts             → يبقى
    useNativeInit.ts             → يبقى
    useBackButton.ts             → يبقى
    useGridDensity.ts            → يبقى
  lib/
    photoDb.ts                   → v6 schema مُصغّرة
    deviceMedia.ts               → يبقى
    providers/telegram.ts        → يبقى + دوال feed
    syncEngine.ts                → مبسّط
    exif.ts, video.ts, diagnostics.ts, native.ts, notifications.ts, ota.ts, viewTransition.ts, utils.ts, confirmDialog.tsx, timeline.ts, mockPhotos.ts
```
كل ما عدا ذلك يُحذف.

---

## 8. تفاصيل تقنية

**Telegram feed**
- `getUpdates?offset=N&timeout=30&allowed_updates=["message","channel_post"]`
- نخزّن `lastUpdateId` في `kv`.
- الرسائل الأقدم من `getUpdates` (أكثر من 24 ساعة أو مُستهلكة) لا يعيدها تليكرام — لذا نبني الفهرس تدريجياً من لحظة أول تشغيل، ونشرح ذلك للمستخدم في banner أول مرة.
- بديل مستقبلي: `forwardMessages`/قراءة الشات عبر MTProto — خارج نطاق هذه الجولة.

**التنزيل**
- على Android: `Filesystem.writeFile({ directory: Directory.Documents })` + `Media.savePhoto` إن توفّر — نبدأ بـ Filesystem فقط.

**الأذونات**
- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `POST_NOTIFICATIONS`, `INTERNET`. لا حاجة لـ storage القديم.

---

## 9. خطوات التنفيذ بالترتيب
1. حذف الملفات المذكورة + إزالة تبعياتها من `package.json`.
2. تحديث `photoDb.ts` إلى v6 + migration بسيط (drop tables عبر Dexie version upgrade).
3. تبسيط `syncEngine.ts` + تحديث الحقول.
4. كتابة `useTelegramFeed.ts` + `TelegramScreen.tsx`.
5. تبسيط `PhotoGrid` و `Lightbox` (swipe + pinch + shared-element).
6. إعادة كتابة `pages/Index.tsx` و `MobileNav.tsx` بتبويبتين.
7. تنظيف `SettingsPage` — فقط أقسام: البوت، وضع المزامنة، الأذونات، التشخيصات.
8. فحص TypeScript + إصلاح كل import مكسور.
9. تحديث `.lovable/plan.md` بنسخة مُقتضبة.

---

## 10. أسئلة صغيرة قد تظهر أثناء التنفيذ
- هل نُبقي على الفيديو؟ الخطة: نعم، `sendDocument` يدعمه، والعارض يعرض `<video controls>`.
- المفضلة على الشبكة؟ الخطة: تُحذف (كانت داخل photoStates المحذوف).
