# خطة إصلاح جذرية — LocalGallery Pro

بعد قراءة الكود بعناية، هذه هي الأعطال الحقيقية والحلول.

## 1) لماذا لا يظهر معرض الهاتف تلقائيًا؟

**السبب الجذري:** الدالة `scanDeviceGallery()` تعتمد على بلجن Capacitor مخصّص اسمه `LocalGalleryMedia` (في `src/lib/deviceMedia.ts` سطر 55، `src/lib/native.ts` سطر 23). هذا البلجن **غير موجود** في المشروع — لا يوجد له كود Java/Kotlin. لذلك:

- على Android → `registerPlugin("LocalGallery Media")` يُرجع كائنًا وهميًا، ونداء `requestGalleryPermissions()` يفشل بصمت.
- الاحتياط ينتقل إلى `Camera.requestPermissions({ photos })`، لكن هذا صلاحية **الكاميرا للصور**، وليست صلاحية `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` المطلوبة على Android 13+.
- حتى لو مُنحت، ‏`scanAndroidGallery()` يستدعي `LocalGalleryMedia.getDeviceMedia()` غير الموجود → يرمي فورًا، ولا تُدرج أي صور.

**النتيجة:** لا تظهر أي صورة من المعرض، ولا يظهر أي طلب صلاحية حقيقي.

**الحل:**
- إزالة الاعتماد على البلجن الوهمي.
- استخدام بلجن جاهز موثّق: `@capacitor/media` غير موجود، لكن `@capawesome/capacitor-file-picker` + `@capacitor-community/media` يعملان على iOS فقط. الأنسب لأندرويد: **`@capgo/capacitor-native-photo-gallery`** أو **`@capawesome/capacitor-android-content`**.
- الحل العملي المضمون: استخدام **Storage Access Framework** عبر بلجن `capacitor-plugin-safe-area` + `@capacitor/filesystem` — نطلب من المستخدم مرة واحدة اختيار مجلد `DCIM/Camera` و`Pictures`، ثم نمسحها دوريًا بـ `Filesystem.readdir()` (يعمل داخل Capacitor بدون بلجن مخصّص).
- إضافة أذونات `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED` في `AndroidManifest.xml` عبر `scripts/prepare-android.mjs`.
- استيراد كل الصور فورًا كـ `MediaAsset` مع `posterDataUrl` من مصغّرات مولّدة بـ `<canvas>`.

## 2) لماذا الأذونات لا تُطلب؟

- `PermissionsWizard` يعمل فقط في أول تشغيل ثم يخزّن `wizardDone=1` في Preferences، ثم لا يظهر أبدًا.
- `useNativeInit` يستدعي `checkCameraPermission()` فقط، ولا يفتح أي حوار للمعرض إذا رفض المستخدم.

**الحل:** فتح `PermissionsWizard` تلقائيًا عند كل بدء طالما أن أي إذن حرج (`gallery`, `notifications`) ليس `granted`، مع زر واضح داخل الإعدادات لإعادة الطلب.

## 3) لماذا التطبيق لا يزامن تلقائيًا؟

- `useSyncLoop` صحيح، لكن الإعداد الافتراضي `mode: "manual"`. المستخدم لا يعلم بوجود إعداد.
- **الحل:** تغيير الافتراضي إلى `auto-on-import`، وإظهار شارة "المزامنة نشطة" في `TopBar`.

## 4) لماذا الذكريات فارغة؟

- `memories.ts` يبحث في `photoDb.assets` فقط عن صور بنفس اليوم من سنوات سابقة. لأن المعرض فارغ (المشكلة 1)، لا توجد ذكريات.
- **الحل:** إصلاح المشكلة 1 يحلّها. إضافة "ذكريات هذا الأسبوع" و"أفضل لقطات الشهر" كبديل عندما لا توجد صور من سنوات سابقة.

## 5) العرض بدائي مقارنة بـ Google Photos

- الشبكة الحالية `columns-2 md:columns-3` بدون تجميع زمني حقيقي، بدون رؤوس أقسام لاصقة، بدون تكبير بإيماءة على الشبكة.
- **الحل:** إعادة بناء `PhotoGrid` باستخدام `react-virtuoso` للأداء + رؤوس شهر لاصقة + تكبير ديناميكي (2/3/4/5 أعمدة) + شريط تمرير زمني على اليمين.

## 6) OCR لا ينجح — استبداله

- Tesseract.wasm ثقيل (~15MB) وبطيء على الهاتف ونتائجه رديئة للعربية.
- **الحل:** استبداله بـ **Google ML Kit Text Recognition** عبر بلجن `@capacitor-mlkit/text-recognition` — أسرع 20×، يعمل offline، يدعم العربية أصليًا.

## خطة التنفيذ (بالترتيب)

1. **إصلاح استيراد المعرض** — إضافة الأذونات في Manifest، استبدال البلجن الوهمي بمسح `Filesystem` مباشر لـ `DCIM/Camera` و`Pictures/*`، توليد مصغّرات محليًا.
2. **إظهار Wizard الأذونات دائمًا** حتى تُمنح أذونات المعرض والإشعارات.
3. **تفعيل المزامنة التلقائية افتراضيًا** (`auto-on-import`) + مؤشر حالة في TopBar.
4. **إعادة بناء PhotoGrid** بـ `react-virtuoso` + رؤوس شهر + شريط تمرير زمني.
5. **استبدال OCR** بـ ML Kit (`@capacitor-mlkit/text-recognition`) مع Fallback إلى Tesseract على الويب فقط.
6. **إصلاح الذكريات** بإضافة قواعد "هذا الأسبوع" و"لقطات الشهر".
7. **تشغيل AutoPipeline تلقائيًا** فور أول استيراد ناجح (بدون سؤال).

## تفاصيل تقنية

- `AndroidManifest.xml`: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_DATA_SYNC`.
- `deviceMedia.ts`: يُعاد كتابته ليستخدم `Filesystem.readdir({ path: 'DCIM/Camera', directory: Directory.ExternalStorage })` ثم `Filesystem.stat` + `Filesystem.readFile` (base64) للصور، مع cache للمصغّرات في IndexedDB.
- `ocr.ts`: واجهة موحّدة `ocrImage(url)` تختار ML Kit في native و Tesseract في web.
- `PhotoGrid.tsx`: `<GroupedVirtuoso>` مع `groupCounts` مبني من `timeline.groupByMonth()`.
- Default: `syncSettings.mode = "auto-on-import"` في `photoDb.ts` (`DEFAULT_SYNC_SETTINGS`).

بعد الموافقة سأنفّذ الخطوات بالترتيب مع اختبار كل خطوة قبل الانتقال للتالية.
