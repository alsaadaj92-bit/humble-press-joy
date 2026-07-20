import { useEffect, useState } from "react";
import { Bell, Camera, MapPin, Shield, RefreshCw, CheckCircle2, XCircle, HelpCircle, Images, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  checkCameraPermission,
  checkLocationPermission,
  checkNotifPermission,
  isNative,
  platform,
  requestCameraPermission,
  requestLocationPermission,
  requestNotifPermission,
} from "@/lib/native";
import { canScanDeviceGallery, scanDeviceGallery } from "@/lib/deviceMedia";

type Status = "granted" | "denied" | "prompt" | "unknown";

interface Perm {
  id: "camera" | "notif" | "location";
  label: string;
  reason: string;
  icon: typeof Camera;
  check: () => Promise<Status>;
  request: () => Promise<boolean>;
}

const PERMS: Perm[] = [
  {
    id: "camera",
    label: "الكاميرا والمعرض",
    reason: "لالتقاط صور ومسح المستندات واختيار الصور من معرض الهاتف للنسخ الاحتياطي.",
    icon: Camera,
    check: checkCameraPermission,
    request: requestCameraPermission,
  },
  {
    id: "notif",
    label: "الإشعارات",
    reason: "لإعلامك عند اكتمال النسخ الاحتياطي، وظهور ذكريات جديدة، وأخطاء المزامنة.",
    icon: Bell,
    check: checkNotifPermission,
    request: requestNotifPermission,
  },
  {
    id: "location",
    label: "الموقع (اختياري)",
    reason: "لإضافة إحداثيات GPS إلى الصور الملتقطة داخل التطبيق — يبقى محلياً في جهازك فقط.",
    icon: MapPin,
    check: checkLocationPermission,
    request: requestLocationPermission,
  },
];

export function PermissionsPanel() {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const next: Record<string, Status> = {};
    for (const p of PERMS) {
      try { next[p.id] = await p.check(); } catch { next[p.id] = "unknown"; }
    }
    setStatus(next);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const requestOne = async (p: Perm) => {
    try {
      const ok = await p.request();
      toast[ok ? "success" : "error"](ok ? `تم منح: ${p.label}` : `لم يُمنح: ${p.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      await refresh();
    }
  };

  const requestAll = async () => {
    for (const p of PERMS) {
      const cur = status[p.id];
      if (cur !== "granted") await p.request().catch(() => undefined);
    }
    await refresh();
  };

  const running = isNative();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="h-4 w-4 text-primary" />
          الأذونات ({running ? `تطبيق أصلي · ${platform()}` : "متصفح ويب"})
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {running
            ? "امنح الأذونات مرة واحدة ليعمل التطبيق كتطبيق أصلي كامل. كل ما يُقرأ يبقى محلياً على جهازك."
            : "لن تظهر معظم الأذونات هنا إلا داخل تطبيق APK/iOS الأصلي. افتح هذه الصفحة داخل التطبيق المُثبَّت لرؤية الحالة الحقيقية."}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={requestAll}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            اطلب كل الأذونات
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-sm"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            تحديث
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PERMS.map((p) => {
          const s = status[p.id] ?? "unknown";
          const Icon = p.icon;
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.label}</span>
                    <StatusBadge status={s} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.reason}</p>
                  <button
                    onClick={() => requestOne(p)}
                    className="mt-2 rounded-full bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    {s === "granted" ? "أعد الطلب" : "منح"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canScanDeviceGallery() && <DeviceGalleryScanCard />}

      <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground">حول العمل في الخلفية</div>
        <ul className="mt-2 list-disc space-y-1 pr-4">
          <li>عند فتح التطبيق أو عودته من الخلفية أو الاتصال بالشبكة — تُشغَّل المزامنة تلقائياً.</li>
          <li>أندرويد 12+ يقيّد المهام الطويلة في الخلفية. لضمان استمرار الرفع مع إغلاق التطبيق، فعّل "استثناء توفير البطارية" لهذا التطبيق من إعدادات النظام.</li>
          <li>الإشعارات المحلية تصلك عند اكتمال النسخ الاحتياطي حتى لو كان التطبيق مغلقاً (تُطلَق قبل الإغلاق).</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    granted: { label: "مُمنوح", className: "bg-emerald-500/15 text-emerald-500", icon: CheckCircle2 },
    denied: { label: "مرفوض", className: "bg-destructive/15 text-destructive", icon: XCircle },
    prompt: { label: "لم يُطلب", className: "bg-secondary text-muted-foreground", icon: HelpCircle },
    unknown: { label: "—", className: "bg-secondary text-muted-foreground", icon: HelpCircle },
  };
  const s = map[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.className}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}
