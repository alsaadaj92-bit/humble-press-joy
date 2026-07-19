# خطة الوصول إلى 100% تشابه مع Google Photos

**السياسة الحمراء (ثابتة):** لا سحابة خارجية. التخزين: سيرفر محلي / تليكرام / File System API فقط.
**المنهجية:** Zero-Break — إضافات فوق الكود القائم، لا حذف ولا refactor بدون إذن.
**الاختبارات:** كل مرحلة تنتهي بجولة `vitest run` + typecheck + فحص يدوي في المتصفح.

---

## المرحلة 1 — التلقائيات الصامتة (AutoPipeline)
الهدف: كل صورة جديدة تُعالَج تلقائياً بعد الرفع بدون تدخل.

- `src/lib/autoPipeline.ts`: طابور مهام خفيف يعمل بعد كل `syncJob → done`:
  1. OCR (Tesseract) → `photoDb.ocr`
  2. CLIP embedding → `photoDb.embeddings`
  3. Face detection → `photoDb.faces`
  4. Duplicate hash → مقارنة فورية
  5. Thumbnail cache
- `src/hooks/useAutoPipeline.ts`: يشتغل على مستوى `App` مرة واحدة.
- `AutoPipelineConsent.tsx`: dialog أول مرة فقط، الخيار محفوظ في `kv.autoPipelineConsent`.
- تحويل `DEFAULT_SYNC_SETTINGS.mode` من `manual` → `auto-on-import`.
- شارة حالة صغيرة في `TopBar` (يعمل / متوقف / X مهام).

**اختبارات:** `autoPipeline.test.ts` (ترتيب المهام، تخطي المكرر، الاستئناف بعد إعادة التشغيل).

---

## المرحلة 2 — التصنيفات الذكية التلقائية (Things / Categories)
الهدف: تعبئة أقسام Videos / Selfies / Screenshots / Things المعروضة حالياً كـ "قريباً".

- `src/lib/categorize.ts`:
  - Screenshots: كشف من dimensions + غياب EXIF camera
  - Selfies: من EXIF (front camera) + وجه واحد كبير مركزي
  - Videos: من mime
  - Things: MobileNet عبر `@huggingface/transformers` (نفس المكتبة المستخدمة لـ CLIP، بدون تبعية جديدة) → tags في `photoDb.tags` (جدول جديد v10)
- `photoDb.ts` v10: إضافة `tags` و `categories` indexes.
- تفعيل الأقسام في `Sidebar` و `Index.tsx` بدل placeholder.

**اختبارات:** `categorize.test.ts` (فيكسات لكل نوع).

---

## المرحلة 3 — Creations (أفلام / Collage / Animation)
الهدف: تفعيل زر "إنشاء (+)" بالكامل.

- `src/lib/creations/movie.ts`: تجميع صور + انتقالات → MP4 عبر `MediaRecorder` على Canvas (بدون ffmpeg).
- `src/lib/creations/collage.ts`: layout إلى Canvas → PNG.
- `src/lib/creations/animation.ts`: GIF/WebP animated من صور متتالية.
- `MovieBuilder.tsx`, `CollageBuilder.tsx`, `AnimationBuilder.tsx`.
- **Suggested creations تلقائية:** اقتراح شهري في `MemoriesPanel` (Highlight Reel).

**اختبارات:** `creations.test.ts` للـ layout logic.

---

## المرحلة 4 — تحسينات UX دقيقة (تكافؤ حقيقي)
- **Drag-to-select** على PhotoGrid (rubber band).
- **Long-press** لتحديد على الجوال + haptic (`navigator.vibrate`).
- **Pinch-zoom Timeline** (يوم/شهر/سنة/كل الوقت).
- **Slideshow** داخل Lightbox (auto-advance + ken burns).
- **Info sidebar** موسّع (حجم، سجل التعديلات، سجل المشاركات).
- **Comparison view** جنباً إلى جنب في `DuplicatesPanel`.
- **Locked Folder**: PIN منفصل عن E2EE، مجلد مخفي من كل الاستعلامات.

**اختبارات:** `selection.test.ts`, `lockedFolder.test.ts`.

---

## المرحلة 5 — الخريطة التفاعلية الحقيقية
- `PlacesPanel`: استبدال SVG الثابت بخريطة قابلة للـ pan/zoom باستخدام `leaflet` (موجود؟ لا — سيُطلب إذن) **أو** بديل بدون تبعية: canvas pan/zoom يدوي + عرض العناقيد.
- تفضيل البديل بدون تبعية للحفاظ على Zero-Cloud (بلا tile servers خارجية).

**اختبارات:** `mapView.test.ts`.

---

## المرحلة 6 — الأتمتة الدورية والموثوقية
- **Backup تلقائي** أسبوعي للـ metadata (JSON) إلى المزود النشط.
- **Sweep تلقائي** لسلة المهملات (موجود) + تنظيف embeddings اليتيمة.
- **إشعارات PWA** عند اكتمال المزامنة أو فشل متكرر.
- **Background Sync API** (حيث يتوفر) لاستئناف الرفع بعد إغلاق التبويب.
- **Cast API** (Presentation API) لعرض Slideshow على TV.
- **Web Share Target**: استقبال صور من تطبيقات أخرى مباشرة → طابور الرفع.

**اختبارات:** `backup.test.ts` (موجود، سنُضيف حالات دورية)، `webShareTarget.test.ts`.

---

## سياسة الاختبار المستمر (كل مرحلة)
1. **قبل التنفيذ:** قراءة الملفات المستهدفة كاملة (Workspace Awareness).
2. **أثناء التنفيذ:** كتابة الاختبار مع الميزة (TDD مرن).
3. **بعد كل مرحلة:**
   ```bash
   bunx vitest run
   bunx tsgo --noEmit
   ```
4. **فحص المتصفح** عبر Playwright لكل ميزة UI جديدة (screenshot + تأكيد).
5. **لا merge لمرحلة** قبل: صفر أخطاء TS + كل الاختبارات خضراء + الميزات القديمة تعمل.

---

## الفرق النهائي المقصود مع Google Photos
| البند | Google Photos | نحن (بعد الخطة) |
|---|---|---|
| التخزين | Google Cloud | Local server / Telegram (اختيار المستخدم) |
| الذكاء | سحابي | محلي 100% (CLIP/OCR/Face/MobileNet في المتصفح) |
| المشاركة | روابط سحابية | ZIP / Telegram link |
| الطباعة | متجر Google | ❌ لا ينطبق (Zero-Cloud) |
| كل شيء آخر | ✅ | ✅ مطابق |

---

## الجدولة المقترحة
- **م1 (AutoPipeline):** جولة واحدة — أساس كل ما بعده.
- **م2 (Categories):** جولة واحدة.
- **م3 (Creations):** 2 جولات (Movie منفصل).
- **م4 (UX):** 2 جولات.
- **م5 (Map):** جولة واحدة.
- **م6 (الأتمتة):** جولة واحدة.

**المجموع:** ~8 جولات محادثة للوصول إلى 100%.

هل أبدأ فوراً بـ **Phase 1 (AutoPipeline)** الآن؟
