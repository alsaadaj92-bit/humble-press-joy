// Local-only photo state storage via Dexie/IndexedDB.
// Never sent to any server — pure client-side metadata + provider configs.
import Dexie, { type Table } from "dexie";
import type { ExifData } from "./exif";

export interface PhotoState {
  id: string;
  favorite?: boolean;
  archived?: boolean;
  trashedAt?: number;
  /** Locked Folder — hidden from all views until the folder is unlocked in-session. */
  locked?: boolean;
  exif?: ExifData;
  sourceName?: string;
  importedAt?: number;
}

export type ProviderKind = "telegram" | "localServer" | "fileSystem" | "device";

export interface ProviderConfig {
  kind: ProviderKind;
  configured: boolean;
  // Telegram
  botToken?: string;
  chatId?: string;
  // Local Node.js server
  baseUrl?: string;
  // File System Access (handle stored separately in memory or via IDB serialization)
  fsRootName?: string;
}

export interface MediaAsset {
  id: string;
  provider: ProviderKind;
  name: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
  date: number;       // taken date, else uploaded date
  createdAt: number;  // uploaded/local timestamp
  exif?: ExifData;
  telegram?: { fileId: string; messageId?: number; filePath?: string };
  local?: { url: string; path: string };
  fs?: { path: string };
  /** Native device gallery — identifier from @capacitor-community/media. */
  deviceIdentifier?: string;
  /** Media kind — defaults to image when omitted. */
  kind?: "image" | "video";
  /** Video duration in seconds. */
  duration?: number;
  /** Data URL poster frame for videos (kept small — under ~100KB). */
  posterDataUrl?: string;
  /** Locally-imported original blob — used to display in the gallery even when
   *  no cloud/sync provider is configured. Persisted in IndexedDB. */
  blob?: Blob;
  /** Present when the stored file is E2EE ciphertext. */
  encryption?: {
    alg: "AES-GCM-256";
    originalName: string;
    originalMime: string;
    originalSize: number;
  };
}


export interface KV {
  key: string;
  value: string;
}

// --- Telegram topic routing -------------------------------------------------
export type TopicRuleKind =
  | "by-year"
  | "by-year-month"
  | "by-camera"
  | "by-has-gps"
  | "default";

export interface TopicRule {
  id: string;              // uuid
  topicId: number;         // Telegram message_thread_id
  topicName: string;       // display name
  kind: TopicRuleKind;
  match?: string;          // for by-year "2024", by-year-month "2024-06", by-camera "Canon EOS R6", by-has-gps "yes"|"no"
  priority: number;        // lower = evaluated first
}

// --- Sync engine ------------------------------------------------------------
export type SyncStatus = "pending" | "uploading" | "done" | "failed" | "paused";

export interface SyncJob {
  id: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  blob: Blob;              // stored locally in IndexedDB — never sent anywhere except the chosen provider
  provider: ProviderKind;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  progress?: number;       // 0..1
  assetId?: string;        // set when done
}

export type SyncMode = "manual" | "auto-on-import" | "auto-interval";
export type CompressFormat = "webp" | "jpeg" | "original";

export interface SyncSettings {
  mode: SyncMode;
  intervalMinutes: number;    // used when mode = auto-interval
  wifiOnly: boolean;
  maxFileMb: number;
  paused: boolean;
  autoCreateTopics: boolean;  // auto-create Telegram forum topic per album
  // Local pre-upload compression (never happens on the wire).
  compressEnabled: boolean;
  compressFormat: CompressFormat;
  compressQuality: number;    // 0.1..1
  compressMaxDim: number;     // longest edge in px (0 = keep)
  compressSkipUnderKb: number;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  mode: "auto-on-import",
  intervalMinutes: 15,
  wifiOnly: false,
  maxFileMb: 200,
  paused: false,
  autoCreateTopics: true,
  compressEnabled: false,
  compressFormat: "webp",
  compressQuality: 0.82,
  compressMaxDim: 2560,
  compressSkipUnderKb: 300,
};


// --- Albums (auto + manual) -------------------------------------------------
export type AlbumKind = "auto-year" | "auto-month" | "manual";

export interface Album {
  id: string;               // stable e.g. "auto-year-2024", "auto-month-2024-06", uuid for manual
  name: string;             // display name
  kind: AlbumKind;
  key?: string;             // "2024" or "2024-06"
  topicId?: number;         // Telegram forum topic binding
  coverAssetId?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AlbumMember {
  id: string;               // `${albumId}:${assetId}`
  albumId: string;
  assetId: string;
  addedAt: number;
}


export interface EmbeddingRow {
  id: string;
  vec: number[];
  dim: number;
  modelId: string;
  updatedAt: number;
}

// --- Faces (local, on-device only) -----------------------------------------
export interface FaceRow {
  id: string;              // `${assetId}:${index}`
  assetId: string;
  descriptor: number[];    // MediaPipe image-embedder descriptor (local only)
  box: { x: number; y: number; width: number; height: number };
  personId?: string;
  detectedAt: number;
  modelId?: string;
  sourceStamp?: number;
  durationMs?: number;
}

export interface PersonRow {
  id: string;              // stable cluster id (e.g. "p-3") or user-created
  name?: string;
  coverFaceId?: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
}

// --- OCR (local text extraction, on-device only) ---------------------------
export interface OcrRow {
  id: string;              // assetId (or photoId)
  text: string;
  lang: string;            // "ara+eng"
  confidence: number;      // 0..100
  updatedAt: number;
}

class PhotoDatabase extends Dexie {
  states!: Table<PhotoState, string>;
  providers!: Table<ProviderConfig, ProviderKind>;
  assets!: Table<MediaAsset, string>;
  kv!: Table<KV, string>;
  topicRules!: Table<TopicRule, string>;
  syncJobs!: Table<SyncJob, string>;
  albums!: Table<Album, string>;
  albumMembers!: Table<AlbumMember, string>;
  embeddings!: Table<EmbeddingRow, string>;
  faces!: Table<FaceRow, string>;
  persons!: Table<PersonRow, string>;
  ocr!: Table<OcrRow, string>;


  constructor() {
    super("localgallery-pro");
    this.version(1).stores({ states: "id, favorite, archived, trashedAt" });
    this.version(2).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
    });
    this.version(3).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
    });
    this.version(4).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
    });
    this.version(5).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
    });
    this.version(6).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      embeddings: "id, modelId, updatedAt",
    });
    this.version(7).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      embeddings: "id, modelId, updatedAt",
      faces: "id, assetId, personId, detectedAt",
      persons: "id, updatedAt, hidden",
    });
    this.version(8).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      albumMembers: "id, albumId, assetId, addedAt",
      embeddings: "id, modelId, updatedAt",
      faces: "id, assetId, personId, detectedAt",
      persons: "id, updatedAt, hidden",
    });
    this.version(9).stores({
      states: "id, favorite, archived, trashedAt, importedAt",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      albumMembers: "id, albumId, assetId, addedAt",
      embeddings: "id, modelId, updatedAt",
      faces: "id, assetId, personId, detectedAt",
      persons: "id, updatedAt, hidden",
      ocr: "id, updatedAt",
    });
    this.version(10).stores({
      states: "id, favorite, archived, trashedAt, importedAt, locked",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      albumMembers: "id, albumId, assetId, addedAt",
      embeddings: "id, modelId, updatedAt",
      faces: "id, assetId, personId, detectedAt",
      persons: "id, updatedAt, hidden",
      ocr: "id, updatedAt",
    });
    this.version(11).stores({
      states: "id, favorite, archived, trashedAt, importedAt, locked",
      providers: "kind, configured",
      assets: "id, provider, date, createdAt",
      kv: "key",
      topicRules: "id, priority, kind",
      syncJobs: "id, status, createdAt, updatedAt",
      albums: "id, kind, key, updatedAt",
      albumMembers: "id, albumId, assetId, addedAt",
      embeddings: "id, modelId, updatedAt",
      faces: "id, assetId, personId, detectedAt, modelId, sourceStamp",
      persons: "id, updatedAt, hidden",
      ocr: "id, updatedAt",
    });
  }
}




export const photoDb = new PhotoDatabase();


export async function setPhotoStates(ids: string[], patch: Partial<PhotoState>) {
  await photoDb.transaction("rw", photoDb.states, async () => {
    for (const id of ids) {
      const existing = (await photoDb.states.get(id)) ?? { id };
      await photoDb.states.put({ ...existing, ...patch, id });
    }
  });
}

export function localPhotoId(file: { name: string; size: number; lastModified: number }) {
  return `local-${file.size}-${file.lastModified}-${file.name}`;
}
