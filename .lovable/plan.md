# خطة الإصلاح الشاملة — مطابقة Google Photos

بعد فحص الصور المرفقة والكود، هذه خطة تنفيذ متكاملة تُنجز دفعة واحدة.

## 1) إصلاحات حرجة (Bugs)

**أ. الصور لا تظهر**
- سبب جذري: `useResolvedAssets` يعتمد على مزوّد نشط قبل عرض الـ blob المحلي في بعض المسارات، و`useNativeInit` قد لا يستدعي `scanDeviceGallery` بعد منح إذن جديد.
- الحل: عرض فوري من `asset.blob` عبر `URL.createObjectURL` **قبل** أي منطق مزوّد، تحرير الـ URLs عند التفريغ، وإعادة الفحص التلقائي عند تغيّر حالة الأذونات (event listener على `visibilitychange`).

**ب. زر الرجوع لا يعمل (Android)**
- إضافة `App.addListener('backButton')` من `@capacitor/app`: يغلق Lightbox → يخرج من Selection → يعود لتبويب "الصور" → ثم يخرج من التطبيق.

**ج. زر تبديل شكل العرض (شبكة/مربعات/قائمة) لا يعمل**
- ربط `DensityToggle` بالحالة الفعلية `density` في `Index.tsx` وتمريرها إلى `PhotoGrid` (حالياً معزول).

**د. الذكريات لا تتغير تلقائياً**
- إضافة carousel مع `setInterval` كل 5 ثوانٍ + swipe gestures، ودوران عبر الذكريات الأسبوعية/السنوية.

## 2) مطابقة Google Photos (تصميم)

**Top Bar** (مطابق للصور المرفقة):
- شعار دوّار + "Photos" — نقاط إشعار + زر `+` + جرس + Avatar المستخدم
- شريط بحث في الوسط مثل GPhotos الجديد
- رقاقات (Chips) أسفل: ذكريات / أشخاص / أماكن — إخفاء الشرائط عند التمرير للأسفل، إظهارها للأعلى

**Bottom Nav** (4 تبويبات مطابقة تماماً):
- Photos (الرئيسي) — Collections (المكتبة) — Create (إنشاء) — Search (بحث)
- الأيقونة النشطة تحصل على خلفية "pill" زرقاء شفافة

**Collections/Library** (مطابق لصورك):
- شبكة 2×N: Favourites, Bin, Screenshots, Archive
- بلاطات كبيرة: Albums, On this device, People, Moments
- قوائم: Screenshots, Videos, Documents, Utilities

**Photos view**:
- عناوين تاريخ يسارية "Sat 4 Jul" + زر تحديد + قائمة 3-نقاط لكل قسم
- عرض full-bleed بدون هوامش

**Lightbox المحسّن**:
- سحب لأعلى لعرض التفاصيل (info sheet)، سحب لأسفل للإغلاق
- شريط thumbnails أسفل للتصفح السريع
- Zoom بإصبعين + double-tap
- انتقالات View Transitions محسّنة

**Profile Sheet** (مطابق لصورتك):
- ضغط الـ Avatar يفتح Bottom Sheet: الاسم + البريد + استخدام التخزين (مع شريط تقدم) + Manage/Switch + قائمة إجراءات

## 3) معالج الأذونات (First-Launch Wizard)

شاشة كاملة عند أول تشغيل تطلب دفعة واحدة وبشرح واضح:
1. الوصول لكل الصور والفيديوهات
2. الكاميرا
3. الإشعارات
4. الموقع (لتفاصيل GPS)
5. تعطيل تحسين البطارية (للمزامنة الخلفية)
6. تشغيل: الفحص التلقائي، التنظيم بالذكاء الاصطناعي، الوجوه، OCR، المزامنة التلقائية

مع مفاتيح تشغيل/إيقاف لكل ميزة، ثم "متابعة". يُحفظ التنفيذ في `localStorage`.

## 4) تجميع إضافاتنا في مكان واحد

قسم جديد في المكتبة **"أدواتنا المتقدمة"** (Zero-Cloud Tools) يجمع:
- Telegram Sync — E2EE Vault — Locked Folder — Face Clustering — CLIP Search — OCR — Duplicates — Magic Eraser — Doc Scanner — Live Albums — Backup/Restore — Places Map — Provider Rules — OTA Updates

## 5) شاشة كاملة (Immersive Edge-to-Edge)

- `StatusBar.setOverlaysWebView({ overlay: true })` + `StatusBar.setStyle(Dark)` — شفافية كاملة
- `NavigationBar.setTransparency(true)` (Android)
- `viewport-fit=cover` في `index.html`
- استخدام `env(safe-area-inset-*)` في التوب-بار والبوتوم-ناف
- إخفاء شريط الحالة عند Lightbox

## القسم التقني

**ملفات جديدة:**
- `src/components/gallery/PermissionsWizard.tsx`
- `src/components/gallery/ProfileSheet.tsx`
- `src/components/gallery/AdvancedToolsHub.tsx`
- `src/components/gallery/MemoriesCarousel.tsx`
- `src/hooks/useBackButton.ts`
- `src/hooks/useImmersive.ts`

**ملفات تُعدَّل:**
- `src/pages/Index.tsx` — ربط density، wizard، back button، immersive init
- `src/components/gallery/TopBar.tsx` — تخطيط GPhotos الجديد
- `src/components/gallery/MobileNav.tsx` — Photos/Collections/Create/Search
- `src/components/gallery/LibraryHub.tsx` — تخطيط Collections الجديد
- `src/components/gallery/Lightbox.tsx` — thumbnails, swipe, zoom
- `src/components/gallery/MemoriesPanel.tsx` → carousel تلقائي
- `src/hooks/useNativeInit.ts` — إعادة فحص عند العودة للتطبيق
- `src/hooks/useResolvedAssets.ts` — أولوية مطلقة للـ blob
- `index.html` — viewport-fit=cover
- `capacitor.config.ts` — StatusBar overlay
- `scripts/prepare-android.mjs` — تفعيل edge-to-edge في `styles.xml`

**Capacitor plugins مطلوبة (تُثبَّت تلقائياً):**
- `@capacitor/app` (زر الرجوع)
- `@capacitor/status-bar` (شفافية)
- `@capawesome/capacitor-android-edge-to-edge-support`

**اختبار:**
- Typecheck + build بعد كل موجة
- تحقق أن `photoDb.assets` يحتوي blob قابل للعرض دون مزوّد
- تحقق أن الـ URLs تُحرَّر (لا تسريب ذاكرة)

## التنفيذ

سيتم بأربع موجات متتابعة داخل نفس الرد بعد الموافقة:
1. Infrastructure (plugins, back-button, immersive, wizard)
2. Bug fixes (photos display, density toggle, back)
3. UI parity (TopBar/BottomNav/Library/ProfileSheet)
4. Polish (Lightbox، Memories carousel، Advanced Tools Hub)

بعد الموافقة سأنفّذ كل شيء دفعة واحدة.
