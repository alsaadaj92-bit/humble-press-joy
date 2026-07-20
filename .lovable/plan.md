# خطة شاملة: OTA + تطابق تصميمي كامل + عرض بعرض الشاشة

سيتم التنفيذ كاملاً دفعة واحدة، مع اختبار بعد كل موجة (build + typecheck + tests).

---

## الجزء 1: تفعيل OTA (تحديثات فورية دون إعادة تثبيت APK يدوياً)

**الآلية: Version Banner + Auto-download من GitHub Releases** (Zero-Cloud متوافق — لا خدمات طرف ثالث).

**كيف يعمل:**
1. GitHub Actions يبني APK ويرفعه كـ Release عند كل push.
2. التطبيق عند الفتح يفحص GitHub Releases API (عام، بلا مفاتيح).
3. إن وُجد إصدار أحدث → بانر في الأعلى: "تحديث متاح — v1.2.3" + زر "تحميل وتثبيت".
4. الزر ينزّل APK إلى Downloads ويفتح مثبّت Android عبر `@capacitor/file-opener`.
5. Android يعرض شاشة الترقية الأصلية — المستخدم يوافق.

**الملفات:**
- `src/lib/ota.ts` — فحص الإصدار (مقارنة `APP_VERSION` من `package.json` مع آخر tag).
- `src/hooks/useOtaCheck.ts` — يعمل عند launch + كل 6 ساعات.
- `src/components/gallery/UpdateBanner.tsx` — بانر علوي.
- إضافة قسم "التحديثات" في `SettingsPage` (فحص يدوي + الإصدار الحالي + سجل التحديثات).
- تحديث `.github/workflows/android-build.yml` — إنشاء GitHub Release تلقائي عند tag push.
- `scripts/prepare-android.mjs` — إضافة `REQUEST_INSTALL_PACKAGES` للـ manifest.
- تثبيت `@capacitor/file-opener` + `@capacitor/filesystem` (موجود).

---

## الجزء 2: عرض بعرض الشاشة كاملاً (Full-Bleed Layout) ⭐ جديد

**المشكلة:** الحاوية الحالية تقصر العرض (`max-w-*`) وتترك هوامش جانبية كبيرة على الشاشات الكبيرة.

**الحل:**
- إزالة `src/App.css` (يحتوي `max-width: 1280px` على `#root` وهو المتسبب الرئيسي).
- `src/pages/Index.tsx` — إزالة أي `container` / `max-w-*` من الحاوية الرئيسية للشبكة.
- الشبكة تمتد من الحافة للحافة مع padding داخلي بسيط فقط (`px-2` أو `px-4`).
- الـ Sidebar يبقى بعرضه الثابت (256px) والمحتوى يأخذ 100% من المتبقي.
- زيادة أعمدة `densityColClasses` للشاشات الكبيرة (`2xl:masonry-col-10`) لملء العرض.
- إضافة breakpoint `2xl` (1536px) و`3xl` مخصّص (1920px) في `tailwind.config.ts`.
- `TopBar` يمتد لكامل العرض بدلاً من كونه محاذياً للحاوية.

---

## الجزء 3: تطابق تصميمي مع Google Photos

### الفروقات الحالية:

| العنصر | Google Photos | نحن الآن | الحل |
|---|---|---|---|
| رأس الصفحة | شريط بحث عائم كبير مركزي | Hero كبير بعنوان | حذف Hero، بحث عائم |
| الشبكة | مربعات متساوية 2px gap | Masonry أعمدة | CSS Grid `aspect-square` + gap-0.5 |
| Sticky headers | يلتصق بأعلى قوي | خفيف | تقوية `bg-background` + shadow |
| Bottom Nav | 4 تبويبات | 5 تبويبات ✓ (قريب) | تقليم إلى 4 (Photos/Search/Library/Sharing) |
| FAB | لا يوجد على ديسكتوب | ظاهر دائماً | إخفاء `md:hidden` |
| Library Hub | صفحة بطاقات موحّدة | أقسام منفصلة | تحسين `LibraryHub` |
| زر اختيار | يظهر عند hover ✓ | مطبّق ✓ | لا تغيير |
| خلفية | أسود صافي `#000` | `#1b1c1e` | تحويل `--background` إلى `0 0% 0%` |
| Lightbox | overlays تختفي تلقائياً | ثابتة | auto-hide بعد 2 ثانية |
| Density toggle | Zoom بسيط | 3 خيارات ✓ | لا تغيير |

### التنفيذ في موجات:

**موجة A — الأساسيات البصرية + Full-width:**
- إزالة `App.css`، فتح الحاوية للعرض الكامل.
- `--background: 0 0% 0%` + `--card: 0 0% 8%`.
- Sticky date headers أقوى (bg-black/90 + shadow).
- إزالة `SectionHero` من الصور.
- زيادة أعمدة الشبكة للشاشات الكبيرة.

**موجة B — التنقّل:**
- `TopBar` بحث عائم مركزي (`rounded-full`, `max-w-xl mx-auto`).
- تقليم `MobileNav` إلى 4 تبويبات.
- إخفاء `UploadFab` على ديسكتوب.

**موجة C — التفاصيل:**
- Lightbox: auto-hide overlays بعد 2s.
- تحسين `LibraryHub` كبطاقات موحّدة.

**موجة D — OTA:**
- تنفيذ نظام Version Banner كاملاً.

---

## اختبار بعد كل موجة
- `bun run build` — التأكد من عدم كسر الأنواع.
- `bunx vitest run` — الاختبارات الموجودة.
- Playwright screenshot — التحقق البصري (خصوصاً عرض الشاشة الكامل على 1920px).

---

## بعد التنفيذ: فروقات متبقية (نابعة من طبيعة Zero-Cloud، لن تُنفّذ)

1. Google Lens (يحتاج AI سحابي).
2. Assistant/Stylize AI الضخم.
3. Cinematic Photos (depth server-side).
4. Cast إلى Nest Hub.
5. Print Store التجاري.
6. Partner Sharing عبر حسابات Google.
7. Cross-device sync الفوري.
8. Storage manager (Google One).
9. Face grouping بأسماء من جهات الاتصال Google.
10. Auto-upload من كل التطبيقات (يحتاج background service كامل).

---

قل "نفّذ" لأبدأ.
