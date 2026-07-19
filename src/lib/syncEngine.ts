/**
 * Sync engine — a small local queue that uploads pending files to the active
 * provider. Runs in the browser only. Nothing leaves the device except the
 * request to the provider the user chose (Telegram / Local server).
 */
import {
  photoDb,
  DEFAULT_SYNC_SETTINGS,
  type MediaAsset,
  type ProviderKind,
  type SyncJob,
  type SyncSettings,
} from "@/lib/photoDb";
import { extractExif } from "@/lib/exif";
import { telegramSendDocument, telegramCreateForumTopic } from "@/lib/providers/telegram";
import { localServerUpload } from "@/lib/providers/localServer";
import {
  localServerUploadChunked,
  localServerSupportsChunked,
  localServerAbort,
} from "@/lib/providers/localServerChunked";
import { pickTopicForAsset } from "@/lib/topicRouting";
import {
  ensureAutoAlbumsForDate,
  pickAlbumTopicForDate,
  setAlbumTopic,
  getUploaderName,
} from "@/lib/albums";
import { getActiveProviderKind } from "@/lib/providers";
import { encryptFile, isUnlocked as isE2EEUnlocked, isE2EEConfigured } from "@/lib/crypto";
import { compressImage } from "@/lib/compress";



const SETTINGS_KEY = "syncSettings";

export async function getSyncSettings(): Promise<SyncSettings> {
  const raw = await photoDb.kv.get(SETTINGS_KEY);
  if (!raw?.value) return DEFAULT_SYNC_SETTINGS;
  try {
    return { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(raw.value) };
  } catch {
    return DEFAULT_SYNC_SETTINGS;
  }
}
export async function setSyncSettings(patch: Partial<SyncSettings>) {
  const cur = await getSyncSettings();
  const next = { ...cur, ...patch };
  await photoDb.kv.put({ key: SETTINGS_KEY, value: JSON.stringify(next) });
  return next;
}

export async function enqueueFiles(files: File[]) {
  const now = Date.now();
  const activeKind = (await getActiveProviderKind()) ?? "telegram";
  const settings = await getSyncSettings();

  // Compress images locally before queuing (opt-in). Runs entirely in the
  // browser via Canvas; never leaves the device.
  const prepared: File[] = [];
  for (const f of files) {
    if (settings.compressEnabled && f.type.startsWith("image/")) {
      try {
        const res = await compressImage(f, {
          enabled: true,
          format: settings.compressFormat,
          quality: settings.compressQuality,
          maxDimension: settings.compressMaxDim,
          skipUnderKb: settings.compressSkipUnderKb,
        });
        prepared.push(res.file);
      } catch {
        prepared.push(f);
      }
    } else {
      prepared.push(f);
    }
  }

  const jobs: SyncJob[] = prepared.map((f, i) => ({
    id: `job-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: f.name,
    fileSize: f.size,
    fileMime: f.type || "application/octet-stream",
    blob: f,
    provider: activeKind as ProviderKind,
    status: "pending",
    attempts: 0,
    createdAt: now + i,
    updatedAt: now + i,
  }));
  await photoDb.syncJobs.bulkPut(jobs);
  return jobs.map((j) => j.id);
}


export async function retryJob(id: string) {
  await photoDb.syncJobs.update(id, {
    status: "pending",
    lastError: undefined,
    updatedAt: Date.now(),
  });
}
export async function retryAllFailed() {
  const failed = await photoDb.syncJobs.where("status").equals("failed").toArray();
  await photoDb.syncJobs.bulkPut(
    failed.map((j) => ({ ...j, status: "pending", lastError: undefined, updatedAt: Date.now() })),
  );
}
export async function removeJob(id: string) {
  const job = await photoDb.syncJobs.get(id);
  if (job?.provider === "localServer") {
    const cfg = await photoDb.providers.get("localServer");
    if (cfg?.baseUrl) {
      try { await localServerAbort(cfg.baseUrl, id); } catch { /* ignore */ }
    }
  }
  await photoDb.syncJobs.delete(id);
}
export async function clearCompleted() {
  const done = await photoDb.syncJobs.where("status").equals("done").toArray();
  await photoDb.syncJobs.bulkDelete(done.map((j) => j.id));
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
function isWifiLike() {
  const c = (navigator as unknown as { connection?: { type?: string; effectiveType?: string } })
    .connection;
  if (!c) return true;
  if (c.type) return c.type === "wifi" || c.type === "ethernet";
  return c.effectiveType === "4g" || c.effectiveType === "wifi";
}

async function processOneJob(job: SyncJob): Promise<void> {
  const settings = await getSyncSettings();
  if (settings.paused) return;
  if (!isOnline()) throw new Error("لا يوجد اتصال بالإنترنت");
  if (settings.wifiOnly && !isWifiLike())
    throw new Error("مقيّد بالواي-فاي وأنت على بيانات محمولة");
  if (job.fileSize > settings.maxFileMb * 1024 * 1024)
    throw new Error(`الملف أكبر من الحد المسموح (${settings.maxFileMb}MB)`);

  const cfg = await photoDb.providers.get(job.provider);
  if (!cfg?.configured) throw new Error("مزود التخزين غير مكتمل الإعداد");

  const rawFile = new File([job.blob], job.fileName, { type: job.fileMime });
  const exif = await extractExif(rawFile);
  const takenAt = exif.dateTaken ?? Date.now();
  const baseId = `asset-${crypto.randomUUID()}`;

  // E2EE: if a passphrase is set up AND unlocked, encrypt before sending to Telegram.
  // localServer stays plain so users can browse locally without a passphrase.
  const shouldEncrypt = job.provider === "telegram" && (await isE2EEConfigured());
  let file = rawFile;
  let encryption: MediaAsset["encryption"];
  if (shouldEncrypt) {
    if (!isE2EEUnlocked()) throw new Error("التشفير مفعّل لكنه مقفل — افتح القفل من الإعدادات");
    const enc = await encryptFile(rawFile);
    file = new File([enc.blob], `${rawFile.name}.lgpenc`, { type: "application/octet-stream" });
    encryption = enc.meta;
  }

  let asset: MediaAsset;
  if (job.provider === "telegram") {

    if (!cfg.botToken || !cfg.chatId) throw new Error("إعدادات تيليجرام ناقصة");

    // Ensure auto year/month albums exist for this photo's date.
    const { month } = await ensureAutoAlbumsForDate(takenAt);

    // Resolve topic: album binding wins; then legacy rules; then auto-create.
    let threadId = await pickAlbumTopicForDate(takenAt);
    if (threadId == null) {
      const rules = await photoDb.topicRules.toArray();
      if (rules.length) threadId = pickTopicForAsset({ date: takenAt, exif }, rules);
    }
    if (threadId == null && settings.autoCreateTopics) {
      try {
        const created = await telegramCreateForumTopic(
          cfg.botToken,
          cfg.chatId,
          month.name,
        );
        threadId = created.message_thread_id;
        await setAlbumTopic(month.id, threadId);
      } catch {
        // Group may not be a forum (Topics disabled) or bot lacks perms.
        // Fall back silently — the photo will land in the main chat.
      }
    }

    // Caption: uploader name + album name, so multiple contributors can be
    // distinguished visually inside the same chat.
    const uploader = await getUploaderName();
    const captionParts: string[] = [];
    if (uploader) captionParts.push(`👤 ${uploader}`);
    captionParts.push(`📁 ${month.name}`);
    const caption = captionParts.join("\n");

    const res = await telegramSendDocument(cfg.botToken, cfg.chatId, file, {
      messageThreadId: threadId,
      caption,
    });
    asset = {
      id: baseId,
      provider: "telegram",
      name: file.name,
      size: file.size,
      mime: file.type,
      width: exif.width ?? res.width,
      height: exif.height ?? res.height,
      date: takenAt,
      createdAt: Date.now(),
      exif,
      telegram: { fileId: res.fileId, messageId: res.messageId },
      encryption,
    };

  } else if (job.provider === "localServer") {
    if (!cfg.baseUrl) throw new Error("عنوان الخادم المحلي غير محدد");
    // Prefer chunked/resumable uploads when the server advertises it.
    // Progress is written back to the SyncJob so the UI can render it live.
    const supportsChunked = await localServerSupportsChunked(cfg.baseUrl);
    let res: { url: string; path: string };
    if (supportsChunked) {
      res = await localServerUploadChunked(cfg.baseUrl, file, {
        jobId: job.id,
        onProgress: (received, total) => {
          const p = total > 0 ? received / total : 0;
          void photoDb.syncJobs.update(job.id, {
            progress: Math.max(0, Math.min(1, p)),
            updatedAt: Date.now(),
          });
        },
      });
    } else {
      res = await localServerUpload(cfg.baseUrl, file);
    }
    asset = {
      id: baseId,
      provider: "localServer",
      name: file.name,
      size: file.size,
      mime: file.type,
      width: exif.width,
      height: exif.height,
      date: takenAt,
      createdAt: Date.now(),
      exif,
      local: { url: res.url, path: res.path },
    };
  } else {
    throw new Error(`مزود غير مدعوم: ${job.provider}`);
  }

  // Ensure the year/month albums exist for any provider so the Albums panel
  // stays in sync with what's actually stored.
  await ensureAutoAlbumsForDate(takenAt);



  await photoDb.assets.put(asset);
  await photoDb.syncJobs.update(job.id, {
    status: "done",
    progress: 1,
    assetId: asset.id,
    updatedAt: Date.now(),
    blob: new Blob(), // free memory
  });
}

let running = false;

export async function runSyncCycle(): Promise<{ processed: number; failed: number }> {
  if (running) return { processed: 0, failed: 0 };
  running = true;
  let processed = 0;
  let failed = 0;
  try {
    const settings = await getSyncSettings();
    if (settings.paused) return { processed, failed };

    // Pick pending jobs
    const pending = await photoDb.syncJobs
      .where("status")
      .equals("pending")
      .sortBy("createdAt");

    for (const j of pending) {
      const settingsNow = await getSyncSettings();
      if (settingsNow.paused) break;
      await photoDb.syncJobs.update(j.id, { status: "uploading", updatedAt: Date.now() });
      try {
        await processOneJob(j);
        processed++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = j.attempts + 1;
        await photoDb.syncJobs.update(j.id, {
          status: attempts >= 5 ? "failed" : "pending",
          lastError: msg,
          attempts,
          updatedAt: Date.now(),
        });
        // small backoff
        await new Promise((r) => setTimeout(r, Math.min(1000 * attempts, 5000)));
      }
    }
  } finally {
    running = false;
  }
  if (processed > 0 || failed > 0) {
    try {
      const { notify } = await import("./notifications");
      if (failed > 0) {
        await notify({
          title: "فشل مزامنة بعض الملفات",
          body: `${failed} فشل · ${processed} نجح`,
          tag: "sync-status",
          onlyWhenHidden: true,
        });
      } else {
        await notify({
          title: "اكتملت المزامنة",
          body: `تم رفع ${processed} ملف بنجاح`,
          tag: "sync-status",
          onlyWhenHidden: true,
        });
      }
    } catch {
      /* notifications are best-effort */
    }
  }
  return { processed, failed };
}
