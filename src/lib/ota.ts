// OTA — Over-the-air update check via public GitHub Releases API.
// Zero-Cloud compliant: uses only GitHub's public API, no third-party service.
// The repo is configurable at runtime (Settings) and falls back to VITE_OTA_REPO.

import { Capacitor } from "@capacitor/core";

const REPO_KEY = "lgp-ota-repo";
const LAST_CHECK_KEY = "lgp-ota-last-check";

// Default repo baked into the build. GitHub Actions injects GITHUB_REPOSITORY
// as __OTA_REPO__ automatically, so no manual configuration is ever needed.
const DEFAULT_REPO: string =
  typeof __OTA_REPO__ !== "undefined" && __OTA_REPO__ ? __OTA_REPO__ : "";

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";

export function getRepo(): string {
  try {
    return (
      localStorage.getItem(REPO_KEY) ||
      import.meta.env.VITE_OTA_REPO ||
      DEFAULT_REPO
    ).trim();
  } catch {
    return DEFAULT_REPO;
  }
}

export function setRepo(v: string) {
  try {
    localStorage.setItem(REPO_KEY, v.trim());
  } catch {
    /* ignore */
  }
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  notes?: string;
  apkUrl?: string;
  htmlUrl?: string;
}

/** Compare semver-ish tags (v1.2.3 vs 1.2.4). */
function isNewer(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const [x, y] = [norm(a), norm(b)];
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const av = x[i] ?? 0;
    const bv = y[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const repo = getRepo();
  const current: UpdateInfo = { available: false, currentVersion: APP_VERSION };
  if (!repo || !repo.includes("/")) return current;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return current;
    const data = (await res.json()) as {
      tag_name?: string;
      body?: string;
      html_url?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    const latest = (data.tag_name || "").replace(/^v/i, "");
    if (!latest) return current;

    const apk = data.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
    try {
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }

    return {
      available: isNewer(latest, APP_VERSION),
      currentVersion: APP_VERSION,
      latestVersion: latest,
      notes: data.body ?? "",
      apkUrl: apk?.browser_download_url,
      htmlUrl: data.html_url,
    };
  } catch {
    return current;
  }
}

/** Opens the APK download URL in the system browser (Android will hand off to installer). */
export function launchApkInstall(apkUrl: string) {
  if (Capacitor.isNativePlatform()) {
    // Opening in a new window is intercepted by Capacitor and routed to the system browser,
    // which triggers Android's package installer flow for APK MIME types.
    window.open(apkUrl, "_system");
  } else {
    window.open(apkUrl, "_blank", "noopener,noreferrer");
  }
}

export function lastCheckTime(): number {
  try {
    return Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
  } catch {
    return 0;
  }
}
