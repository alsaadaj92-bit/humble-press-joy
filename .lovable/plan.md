# مقارنة تصميمية كاملة مع Google Photos وخطة التنفيذ

## 1) المقارنة صفحة بصفحة

### الصور (Photos) — الشاشة الرئيسية
| العنصر | Google Photos | لدينا | الفارق |
|---|---|---|---|
| رأس الصفحة | شريط بحث علوي عائم فقط، لا يوجد "Hero" | لدينا `SectionHero` كبير بعنوان "الصور" وخلفية متدرجة | زائد |
| فواصل التاريخ | Sticky headers (اليوم/أمس/الشهر/السنة) | `PhotoGrid` يعرض buckets بدون sticky عناوين واضحة | ناقص |
| شبكة | مربعات متساوية بفواصل 2px، Zoom بـ +/- | Masonry بأعمدة | مختلف |
| Scrubber | شريط سنوات على اليمين | موجود (`TimelineScrubber`) | مطابق |
| FAB رفع | لا يوجد (الرفع من زر داخل TopBar) | UploadFab دائري كبير | زائد |

### المكتبة (Library)
| Google Photos | لدينا | الفارق |
|---|---|---|
| صفحة موحّدة: Albums + Favorites + Archive + Trash + Locked Folder + Utilities كبطاقات | لدينا كل واحد كقسم منفصل في الشريط الجانبي | ناقص: لا يوجد hub موحّد |

### البحث/Explore
مطابق بشكل معقول: People, Places, Things, Categories.

### الذكريات
مطابق (`MemoriesPanel`).

### المشاركة
Google Photos: Conversations + Partner + Shared albums. لدينا stub فقط.

### الإعدادات — أهم فارق (وهو ما نلمّه الآن)
Google Photos تجمع كل الضبط في صفحة واحدة طويلة بأقسام:
- Backup, Storage, Photos grid, Memories, Notifications, Sharing, Privacy, Locked Folder, Partner sharing, Connected apps, About.

**لدينا حالياً** الإعدادات فيها فقط: `IdentityCard` + `EncryptionPanel` + `BackupPanel`.
كل الباقي متناثر في أقسام: `providers`, `sync`, `locked`, `autoPipeline consent`, `notifications` (داخل Backup)، رخصة MCP، ضبط الضغط (داخل Sync)، ضبط الذكريات، إلخ.

---

## 2) قائمة الفروقات التي سنجمعها في صفحة الإعدادات

إعادة تصميم `settings` كصفحة Google-Photos-style: عمود واحد، أقسام مطوية/مفصولة بعنوان + وصف قصير + محتوى:

1. **الحساب والهوية** — من `IdentityCard` (الاسم الذي يظهر في تعليقات تيليجرام).
2. **النسخ الاحتياطي والمزامنة** — رابط لمركز المزامنة + ملخّص الحالة + toggles (تلقائي/يدوي، Wi-Fi فقط، الحد الأقصى للحجم) — منقول مختصر من `SyncCenter`.
3. **جودة الرفع (الضغط)** — بطاقات Preset (Original/High/Balanced/Small) — منقولة من `SyncCenter`.
4. **مزوّدو التخزين** — بطاقة ملخّص + زر "إدارة" ينقل لـ `providers`.
5. **المجلد المؤمَّن (PIN)** — منقول مختصر من `LockedFolderPanel` (تعيين/تغيير PIN فقط).
6. **التشفير من طرف لطرف (E2EE)** — من `EncryptionPanel`.
7. **المعالجة الذكية المحلية (Auto-Pipeline)** — toggles لـ OCR/CLIP/Faces (من `AutoPipelineConsent`).
8. **الإشعارات** — إذن المتصفح + toggles (اكتمال المزامنة، فشل). موجود جزئياً في `BackupPanel`.
9. **النسخة الاحتياطية للميتاداتا** — تصدير/استيراد JSON + النسخ الأسبوعي التلقائي — من `BackupPanel`.
10. **الخصوصية والبيانات** — Zero-Cloud statement + زر "مسح كل الميتاداتا محلياً" + إفراغ سلة المحذوفات.
11. **إعداد الصور والذكريات** — تكرار الذكريات، إخفاء تواريخ معينة (بسيط).
12. **PWA والتخزين المحلي** — حالة الـ Service Worker + استخدام IndexedDB + زر "تحديث/إعادة تسجيل".
13. **حول التطبيق** — الإصدار، الترخيص، رابط GitHub/مستودع، شارة "بدون سحابة".

---

## 3) خطة التنفيذ (هذه الرسالة فقط: الإعدادات)

- إنشاء `src/components/gallery/SettingsPage.tsx` يحوي كل الأقسام أعلاه كبطاقات (Card sections) بنمط Google Photos: عنوان، وصف رمادي صغير، محتوى، فاصل.
- إعادة استخدام المكونات القائمة (`IdentityCard`, `EncryptionPanel`, `BackupPanel`, أجزاء من `SyncCenter` و`LockedFolderPanel` و`AutoPipelineConsent`) عبر استخراج أقسام قابلة للتضمين بدل تكرار المنطق.
- تحديث `src/pages/Index.tsx` ليعرض `<SettingsPage onNavigate={setActiveSection} />` عند `activeSection === "settings"` بدل الكتلة الحالية.
- إبقاء صفحات `providers` و`sync` و`locked` كما هي (الإعدادات تعرض ملخّصاً وزر "فتح الصفحة الكاملة").
- التركيز على التصميم فقط — لا تغييرات في المنطق أو التخزين.

## تفاصيل تقنية

- ملف جديد واحد: `SettingsPage.tsx`.
- سنستخرج من `SyncCenter` كومبوننت مساعد `CompressPresetPicker` و`SyncQuickToggles` لإعادة الاستخدام.
- سنستخرج من `LockedFolderPanel` كومبوننت `LockedFolderPinSettings` (فقط إعدادات PIN بدون شبكة الصور).
- سنستخرج من `AutoPipelineConsent` كومبوننت `AutoPipelineToggles`.
- لا تغيير في `photoDb` ولا في أي منطق تخزين/رفع.

قل "نفّذ" لأبدأ.
