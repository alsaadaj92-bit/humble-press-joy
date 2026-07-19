// Local video helpers. Extracts a poster frame + duration from an
// HTMLVideoElement — entirely in the browser, no server.

export interface VideoMeta {
  duration: number; // seconds
  width: number;
  height: number;
  posterDataUrl?: string; // JPEG data URL
}

export function isVideoMime(mime: string | undefined): boolean {
  return !!mime && mime.startsWith("video/");
}

export function isVideoName(name: string): boolean {
  return /\.(mp4|mov|m4v|webm|mkv|avi|3gp|hevc)$/i.test(name);
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Reads duration + dimensions from a video file, and grabs a poster frame
 * at ~10% of the way through (or `posterTime` seconds if provided).
 * Returns undefined for posterDataUrl if the browser/codec blocks canvas.
 */
export function extractVideoMeta(
  file: File | Blob,
  opts: { posterTime?: number; posterMaxWidth?: number } = {},
): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const cleanup = () => URL.revokeObjectURL(url);

    video.onerror = () => {
      cleanup();
      reject(new Error("تعذّر قراءة الفيديو"));
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const target = Math.min(
        Math.max(opts.posterTime ?? duration * 0.1, 0.1),
        Math.max(duration - 0.1, 0.1),
      );

      const finish = (posterDataUrl?: string) => {
        cleanup();
        resolve({ duration, width, height, posterDataUrl });
      };

      const grabPoster = () => {
        try {
          const maxW = opts.posterMaxWidth ?? 640;
          const scale = width > 0 ? Math.min(1, maxW / width) : 1;
          const cw = Math.max(1, Math.round(width * scale));
          const ch = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish();
          ctx.drawImage(video, 0, 0, cw, ch);
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            finish(dataUrl);
          } catch {
            // Canvas may be tainted (rare for local blobs, common for DRM).
            finish();
          }
        } catch {
          finish();
        }
      };

      video.onseeked = grabPoster;
      try {
        video.currentTime = target;
      } catch {
        // Some codecs won't seek — grab whatever frame is decoded.
        setTimeout(grabPoster, 100);
      }
    };

    video.src = url;
  });
}
