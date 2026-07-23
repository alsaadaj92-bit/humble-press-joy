# خطة الإصلاح الشاملة

## 1. تشخيص الأخطاء من التلمتري

42 خطأ كلها من نفس النوع: `InvalidStateError: Transition was aborted because of invalid state` — مصدرها `runViewTransition` في `src/lib/viewTransition.ts` عند فتح/إغلاق الـ Lightbox بسرعة أو أثناء انتقال آخر. هذه الأخطاء غير الملتقطة قد تؤدي لكراش WebView على أندرويد.

## 2. الإصلاحات

### أ) الكراش وأخطاء View Transitions

- في `src/lib/viewTransition.ts`: إضافة `try/catch` حول `document.startViewTransition` والتعامل مع `finished.catch` لتجاهل `InvalidStateError` بصمت.
- منع تشغيل transition جديد قبل انتهاء السابق (قفل داخلي).
- إضافة `window.addEventListener('unhandledrejection')` global handler في `src/main.tsx` لمنع تسرب أخطاء الوعود إلى الـ WebView.

### ب) زر الرجوع (Android Back Button)

- مراجعة `src/hooks/useBackButton.ts` — المشكلة: التطبيق فيه 3 تبويبات فقط (Sync/Telegram/Settings) بدون stack تنقل، فالرجوع يخرج مباشرة.
- الإصلاح: 
  - إذا كان الـ Lightbox مفتوح → أغلقه.
  - إذا كنا في تبويب غير "Sync" (الرئيسي) → ارجع لـ Sync.
  - إذا كنا في Sync → اطلب تأكيد الخروج (اضغط مرتين للخروج).

### ج) العمل في الخلفية أثناء المزامنة

- تفعيل `@capacitor/background-runner` أو استخدام Foreground Service عبر البلاجن الأصلي.
- الحل المختار (الأخف): إضافة **Foreground Service** أصلي في `scripts/prepare-android.mjs` يعمل أثناء المزامنة النشطة فقط:
  - إشعار دائم "جاري المزامنة… X/Y"
  - يبقى الـ WebView حياً + JS heartbeat
  - يتوقف تلقائياً عند انتهاء الطابور
- ربط `useSyncEngine` ببدء/إيقاف الخدمة.
- إضافة إذن `FOREGROUND_SERVICE` و `FOREGROUND_SERVICE_DATA_SYNC` في المانيفست.
- إضافة `POST_NOTIFICATIONS` لأندرويد 13+.

### د) حفظ حالة الصفحات (State Persistence)

- التبويب النشط، وضع Lightbox، scroll position، إعدادات العرض (density) — كلها تُفقد عند التنقل.
- الإصلاح: 
  - حفظ `activeTab` في `photoDb.kv` واستعادته عند الإقلاع.
  - حفظ `density` (موجود جزئياً — تأكيد).
  - إبقاء مكونات التبويبات mounted (بدل unmount/remount) عبر عرضهم جميعاً مع `hidden` class للاحتفاظ بـ scroll وحالة القوائم.
  - أو استخدام `sessionStorage` كطبقة سريعة لـ scroll position.

## 3. الملفات المتأثرة

- `src/lib/viewTransition.ts` — قفل + معالجة الأخطاء
- `src/main.tsx` — global unhandledrejection handler
- `src/hooks/useBackButton.ts` — منطق رجوع هرمي
- `src/pages/Index.tsx` — إبقاء التبويبات mounted + persist activeTab
- `src/lib/syncEngine.ts` + `src/hooks/useSyncEngine.ts` — start/stop foreground service
- `src/lib/native.ts` — bridge لـ `startSyncService` / `stopSyncService`
- `scripts/prepare-android.mjs` — حقن `SyncForegroundService.java` + تحديث المانيفست

## 4. الترتيب

1. viewTransition + global handler (يمنع الكراش فوراً)
2. Back button (تجربة أساسية)
3. State persistence (تجربة أساسية)
4. Foreground service (يتطلب إعادة بناء APK)  
اشعار بحالة التقدم للرفع يكون في الاشعارات خارج التطبيق في القائمة المنسدلة

هل أبدأ التنفيذ بهذا الترتيب؟