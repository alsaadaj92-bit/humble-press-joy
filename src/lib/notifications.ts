// Local PWA notifications. No push server — uses the Notification API directly
// when the tab is backgrounded. Silent no-op when permission is not granted.

const KV_KEY = "notificationsEnabled";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsPermission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  return Notification.permission;
}

export interface NotifyOptions {
  title: string;
  body?: string;
  tag?: string;
  /** Skip when the tab is currently visible — Google Photos-style "only when away". */
  onlyWhenHidden?: boolean;
}

export async function notify(opts: NotifyOptions): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  if (opts.onlyWhenHidden && document.visibilityState === "visible") return false;
  try {
    // Prefer SW registration when available (better on mobile).
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(opts.title, {
          body: opts.body,
          tag: opts.tag,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });
        return true;
      }
    }
    new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: "/icon-192.png",
    });
    return true;
  } catch (err) {
    console.warn("[notify] failed", err);
    return false;
  }
}

export { KV_KEY as NOTIFICATIONS_KV_KEY };
