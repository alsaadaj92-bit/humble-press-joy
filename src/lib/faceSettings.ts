import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { photoDb } from "./photoDb";

export type FaceProcessingMode = "fast" | "accurate";

export interface FaceSettings {
  /** fast = GPU delegate when WebView supports it; accurate = CPU/stabler threshold. */
  mode: FaceProcessingMode;
  /** Draw face boxes on photo tiles while reviewing scans. */
  previewBoxes: boolean;
  /** Euclidean clustering threshold for MobileNet L2 embeddings. */
  clusterThreshold: number;
}

export const DEFAULT_FACE_SETTINGS: FaceSettings = {
  mode: "fast",
  previewBoxes: false,
  clusterThreshold: 0.95,
};

const KEY = "face:settings";

function clampThreshold(v: number) {
  return Math.min(0.99, Math.max(0.9, Math.round(v * 100) / 100));
}

export function normalizeFaceSettings(raw: Partial<FaceSettings> | null | undefined): FaceSettings {
  return {
    mode: raw?.mode === "accurate" ? "accurate" : "fast",
    previewBoxes: Boolean(raw?.previewBoxes),
    clusterThreshold: clampThreshold(Number(raw?.clusterThreshold ?? DEFAULT_FACE_SETTINGS.clusterThreshold)),
  };
}

export async function getFaceSettings(): Promise<FaceSettings> {
  const row = await photoDb.kv.get(KEY);
  if (!row?.value) return DEFAULT_FACE_SETTINGS;
  try {
    return normalizeFaceSettings(JSON.parse(row.value) as Partial<FaceSettings>);
  } catch {
    return DEFAULT_FACE_SETTINGS;
  }
}

export async function setFaceSettings(patch: Partial<FaceSettings>): Promise<FaceSettings> {
  const next = normalizeFaceSettings({ ...(await getFaceSettings()), ...patch });
  await photoDb.kv.put({ key: KEY, value: JSON.stringify(next) });
  return next;
}

export function useFaceSettings(): FaceSettings {
  const [settings, setSettingsState] = useState<FaceSettings>(DEFAULT_FACE_SETTINGS);

  useEffect(() => {
    const sub = liveQuery(getFaceSettings).subscribe({ next: setSettingsState });
    return () => sub.unsubscribe();
  }, []);

  return settings;
}

export function faceModelId(mode: FaceProcessingMode) {
  return `mediapipe-blazeface-mobilev3-${mode}-v2`;
}

export function faceSourceStamp(input: { date?: Date | number; createdAt?: number; size?: number }) {
  const date = input.date instanceof Date ? input.date.getTime() : input.date ?? 0;
  return Number(input.createdAt ?? date ?? 0) + Number(input.size ?? 0);
}