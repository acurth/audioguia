import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type DownloadStage = "preparing" | "downloading" | "saving" | "done" | "error";

export type DownloadState = {
  status?: "idle" | "downloading" | "downloaded" | "error";
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
};

const STORAGE_KEY = "offline-downloads";
const downloadStateStore = writable<Record<string, DownloadState>>({});

let initialized = false;

export function initOfflineStore() {
  if (!browser || initialized) return;
  initialized = true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      downloadStateStore.set(JSON.parse(stored));
    } catch (err) {
      console.error("Failed to parse offline state", err);
    }
  }
  downloadStateStore.subscribe((state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
}

export function setDownloadState(id: string, next: DownloadState) {
  downloadStateStore.update((prev) => ({ ...prev, [id]: next }));
}

export function mergeDownloadState(id: string, patch: Partial<DownloadState>) {
  downloadStateStore.update((prev) => ({
    ...prev,
    [id]: { ...(prev[id] ?? {}), ...patch }
  }));
}

export { downloadStateStore };
