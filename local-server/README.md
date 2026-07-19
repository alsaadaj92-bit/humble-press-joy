# LocalGallery Pro — Companion Server

خادم Node.js صغير يستقبل الصور من تطبيق LocalGallery Pro ويحفظها على قرص جهازك. لا شيء يغادر شبكتك المحلية.

## التشغيل

```bash
cd local-server
npm install
npm start
```

سيعمل الافتراضي على `http://localhost:3000` ويكتب الملفات إلى `./storage/YYYY/MM/…`.

## الاتصال من التطبيق

من داخل التطبيق: **مزودو التخزين → الخادم المحلي** → أدخل `http://<IP-جهازك>:3000` → اختبار → حفظ.

للعثور على IP جهازك:
- **Windows:** `ipconfig` → IPv4 Address
- **macOS/Linux:** `ifconfig` أو `ip addr` → inet …

يجب أن يكون الهاتف/المتصفح على **نفس شبكة الواي-فاي**.

## الإعدادات (اختياري)

متغيرات بيئة تُقرأ عند التشغيل:

| المتغير | الافتراضي | الوصف |
|--------|----------|-------|
| `PORT` | `3000` | منفذ HTTP |
| `STORAGE_DIR` | `./storage` | مجلد التخزين |
| `MAX_MB` | `200` | الحد الأقصى لحجم الملف |
| `ALLOW_ORIGIN` | `*` | مصدر CORS المسموح (ضع رابط تطبيقك لتقييده) |

مثال:

```bash
PORT=4000 STORAGE_DIR=/mnt/photos MAX_MB=500 npm start
```

## نقاط الـ API

- `GET  /health` — فحص حالة الخادم.
- `POST /upload` — رفع ملف (multipart، الحقل اسمه `file`). يعيد `{ url, path, name, size, mime }`.
- `GET  /files/<path>` — استرجاع ملف مرفوع.

## ملاحظات أمنية

- الخادم مفتوح على الشبكة المحلية بدون مصادقة — استخدمه فقط داخل شبكة تثق بها.
- لتشغيل من الإنترنت العام: ضعه خلف Reverse Proxy (Caddy/Nginx) مع HTTPS ومصادقة.
