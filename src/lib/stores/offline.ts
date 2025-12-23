import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type DownloadStage = "preparing" | "downloading" | "saving" | "done" | "error";

export type DownloadState = {
  status: "idle" | "downloading" | "downloaded" | "error";
  bytes?: number;
  downloadedBytes?: number;
  progress?: number;
  stage?: DownloadStage;
  completedFiles?: number;
  totalFiles?: number;
  lastUpdate?: number;
  lastAnnouncedProgress?: number;
  lastAnnouncedAt?: number;
  screenreaderText?: string;
  errorMessage?: string;
  cacheResult?: {
    okCount: number;
    failCount: number;
    failedUrls: string[];
  };
};

function normalizeDownloadState(next: Partial<DownloadState> | undefined): DownloadState {
  return {
    status: next?.status ?? "idle",
    bytes: next?.bytes,
    downloadedBytes: next?.downloadedBytes,
    progress: next?.progress,
    stage: next?.stage,
    completedFiles: next?.completedFiles,
    totalFiles: next?.totalFiles,
    lastUpdate: next?.lastUpdate,
    lastAnnouncedProgress: next?.lastAnnouncedProgress,
    lastAnnouncedAt: next?.lastAnnouncedAt,
    screenreaderText: next?.screenreaderText,
    errorMessage: next?.errorMessage,
    cacheResult: next?.cacheResult
  };
}

const STORAGE_KEY = "offline-downloads";
const downloadStateStore = writable<Record<string, DownloadState>>({});

let initialized = false;

export function initOfflineStore() {
  if (!browser || initialized) return;
  initialized = true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, Partial<DownloadState>>;
      const normalized: Record<string, DownloadState> = {};
      for (const [id, state] of Object.entries(parsed ?? {})) {
        normalized[id] = normalizeDownloadState(state);
      }
      downloadStateStore.set(normalized);
    } catch (err) {
      console.error("Failed to parse offline state", err);
    }
  }
  downloadStateStore.subscribe((state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
}

export function setDownloadState(id: string, next: Partial<DownloadState> | undefined) {
  downloadStateStore.update((prev) => ({ ...prev, [id]: normalizeDownloadState(next) }));
}

export function mergeDownloadState(id: string, patch: Partial<DownloadState>) {
  downloadStateStore.update((prev) => {
    const current = prev[id];
    const merged = { ...(current ?? {}), ...patch } as Partial<DownloadState>;
    return {
      ...prev,
      [id]: normalizeDownloadState(merged)
    };
  });
}

export { downloadStateStore };
