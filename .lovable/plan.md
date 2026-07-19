## الخطة: تنظيم داخل تيليجرام + مزامنة تلقائية + خارطة طريق أندرويد

### 1) دعم مواضيع تيليجرام (Forum Topics)
عندما تكون المجموعة من نوع Forum (Topics مفعّلة)، سنسمح بتوجيه كل صورة إلى الموضوع (Topic) المناسب.

**التعديلات:**
- `providers/telegram.ts`: إضافة `message_thread_id` اختياري في `sendDocument`، ودالة `telegramGetForumTopics` (عبر `getUpdates` نلتقط الـ topic_ids تلقائياً).
- `photoDb.ts` (v4): إضافة جدول `topics` يحفظ `{ topicId, name, rule }` حيث `rule` من نوع:
  - `by-year` / `by-year-month` (حسب EXIF أو تاريخ الملف)
  - `by-country` / `by-city` (من GPS عبر تحديد جغرافي بسيط)
  - `by-camera` (من EXIF)
  - `manual` (يدوي عند الرفع)
  - `default` (كل ما لا ينطبق عليه شيء)
- `ProvidersPanel.tsx`: قسم جديد "تنظيم داخل المجموعة" لإضافة/تعديل قواعد التوجيه ومطابقة كل قاعدة مع Topic.
- `providers/index.ts`: عند الرفع، حساب `message_thread_id` من القواعد قبل الاستدعاء.

### 2) محرك المزامنة التلقائية
مركز مزامنة يتابع طابور الرفع مع أوضاع متعددة.

**المكونات الجديدة:**
- `lib/syncEngine.ts`: طابور في IndexedDB (جدول `syncQueue`) بحالات: `pending | uploading | done | failed`، مع محاولات إعادة متزايدة (backoff).
- `hooks/useSyncEngine.ts`: يشغّل الطابور، يتحقق كل X دقيقة، ويحترم إعدادات المستخدم.
- إعدادات المزامنة (في `kv`):
  - الوضع: `manual` / `auto-on-import` / `auto-interval` (كل 5/15/60 دقيقة)
  - مجلدات/مصادر محددة (يدوي عبر File System Access مستقبلاً)
  - شرط الشبكة: أي شبكة / Wi-Fi فقط (نستخدم `navigator.connection`)
  - حد حجم الملف
- `components/gallery/SyncCenter.tsx`: لوحة تعرض الطابور، تقدّم كل ملف، أزرار Pause/Resume/RetryAll، إحصاءات (تم/فشل/متبقّي).
- زر تبديل مزامنة تلقائية في الشريط العلوي بجانب FAB.
- تكامل مع `UploadFab`: بدل الرفع المباشر، يضيف للطابور ثم المحرّك يعالج.

### 3) خارطة طريق تطبيق أندرويد (Capacitor)
سنبدأ التهيئة الآن للانتقال السلس لاحقاً — بدون كسر الويب.

**في هذه المرحلة (تحضير فقط):**
- توثيق في `README.md` وقسم داخل الإعدادات يشرح مسار Capacitor لاحقاً.
- بنية الكود جاهزة: كل الوصول للشبكة/الملفات معزول خلف `providers/*` و `syncEngine`، بحيث نستبدل التنفيذات بـ Capacitor plugins لاحقاً (Background Fetch, Filesystem, Notifications, Permissions).
- لن نضيف `@capacitor/*` الآن (يحتاج تصدير GitHub وبيئة native). فقط نجهّز الواجهات.

### الترتيب التنفيذي
1. تحديث DB إلى v4 + Topics API.
2. UI قواعد التوجيه داخل ProvidersPanel.
3. محرك المزامنة + الطابور + الـ SyncCenter.
4. توثيق مسار الأندرويد.

هل أبدأ التنفيذ؟