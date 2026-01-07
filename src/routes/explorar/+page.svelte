<script lang="ts">
  import { base } from "$app/paths";

  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import {
    getDevModeFromStorage,
    getTourRecords,
    type TourJson,
    type TourStatus
  } from "$lib/data/tours";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
  import type { DownloadState } from "$lib/stores/offline";
  import TourCard from "$lib/components/TourCard.svelte";

  type OfflineFile = { path: string; bytes: number };
  type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

  type TourLink = {
    id: string;
    slug: string;
    name: string;
    status: TourStatus;
    theme?: string;
    sizeBytes?: number;
    offline?: OfflineManifest;
    raw: TourJson;
  };

  const devMode = $derived(browser ? getDevModeFromStorage() : false);
  const tours = $derived(
    getTourRecords(devMode)
      .map(({ id, slug, status, data }) => {
        const name = typeof data.name === "string" ? data.name : slug;
        const theme = typeof data.theme === "string" ? data.theme : undefined;
        const offline = data.offline;
        const sizeBytes = data.offline?.totalBytes;

        return { id, slug, name, status, theme, sizeBytes, offline, raw: data };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "test" ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
  );

  const TOUR_CACHE_PREFIX = "audioguia-tour-";
  const STALL_TIMEOUT_MS = 30000;
  const ANNOUNCE_INTERVAL_MS = 2000;

  let downloadState = $state<Record<string, DownloadState>>({});
  let announcedReady = $state<Record<string, boolean>>({});
  let liveMessage = $state("");
  let hasInitializedAnnouncements = false;
  let unsubscribeStore: (() => void) | null = null;
  let now = Date.now();

  const appBase = base;

  function loadState() {
    if (!browser) return;
    initOfflineStore();
    if (unsubscribeStore) {
      unsubscribeStore();
    }
    unsubscribeStore = downloadStateStore.subscribe((state) => {
      downloadState = state;
      if (!hasInitializedAnnouncements) {
        announcedReady = Object.fromEntries(
          Object.entries(state)
            .filter(([, value]) => value?.status === "downloaded")
            .map(([id]) => [id, true])
        );
        hasInitializedAnnouncements = true;
      }
    });
  }

  function persistState() {
    return;
  }

  function setState(id: string, next: Partial<DownloadState>) {
    setDownloadState(id, next);
  }

  function getStageLabel(stage?: string): string {
    if (stage === "preparing") return "Preparando…";
    if (stage === "saving") return "Guardando para uso offline…";
    if (stage === "done") return "Listo";
    if (stage === "error") return "Error en la descarga";
    return "Descargando audios…";
  }

  function getProgressPercent(state?: DownloadState): number {
    if (!state) return 0;
    if (typeof state.progress === "number") return state.progress;
    if (state.completedFiles && state.totalFiles) {
      return Math.round((state.completedFiles / state.totalFiles) * 100);
    }
    return 0;
  }

  $effect(() => {
    for (const tour of tours) {
      if (downloadState[tour.id]?.status === "downloaded" && !announcedReady[tour.id]) {
        liveMessage = `Tour listo sin conexión: ${tour.name}`;
        announcedReady = { ...announcedReady, [tour.id]: true };
      }
    }
  });

  function getTourById(id: string) {
    return tours.find((tour) => tour.id === id);
  }

  function isStalled(state?: DownloadState): boolean {
    if (!state || state.status !== "downloading") return false;
    if (!state.lastUpdate) return false;
    return now - state.lastUpdate > STALL_TIMEOUT_MS;
  }

  function updateScreenreaderText(
    prev: DownloadState | undefined,
    next: DownloadState,
    label: string,
    progress: number
  ) {
    const lastProgress = prev?.lastAnnouncedProgress ?? -1;
    const lastAnnouncedAt = prev?.lastAnnouncedAt ?? 0;
    const elapsed = Date.now() - lastAnnouncedAt;
    const completedChanged = next.completedFiles !== prev?.completedFiles;
    const currentIndexChanged = next.currentIndex !== prev?.currentIndex;
    const shouldAnnounceProgress =
      (completedChanged || currentIndexChanged) && elapsed >= ANNOUNCE_INTERVAL_MS;

    const stageChanged = prev?.stage !== next.stage;
    const shouldAnnounceStage = stageChanged && next.stage !== "downloading";

    if (next.errorMessage) {
      return {
        screenreaderText: `${label}. ${next.errorMessage}`,
        lastAnnouncedProgress: next.completedFiles ?? lastProgress,
        lastAnnouncedAt: Date.now()
      };
    }

    if (next.stage === "done") {
      return {
        screenreaderText: `${label}. Descarga completa.`,
        lastAnnouncedProgress: 100,
        lastAnnouncedAt: Date.now()
      };
    }

    if (shouldAnnounceStage) {
      return {
        screenreaderText: `${label}. ${getStageLabel(next.stage)}`,
        lastAnnouncedProgress: next.completedFiles ?? lastProgress,
        lastAnnouncedAt: Date.now()
      };
    }

    if (shouldAnnounceProgress) {
      if (typeof next.completedFiles === "number" && typeof next.totalFiles === "number") {
        return {
          screenreaderText: `${label}. Descargando ${next.completedFiles} de ${next.totalFiles}. Archivo ${next.currentIndex ?? 0} de ${next.totalFiles}.`,
          lastAnnouncedProgress: next.completedFiles,
          lastAnnouncedAt: Date.now()
        };
      }
      return {
        screenreaderText: `${label}. ${progress}% descargado.`,
        lastAnnouncedProgress: next.completedFiles ?? lastProgress,
        lastAnnouncedAt: Date.now()
      };
    }

    return {
      screenreaderText: prev?.screenreaderText,
      lastAnnouncedProgress: prev?.lastAnnouncedProgress,
      lastAnnouncedAt: prev?.lastAnnouncedAt
    };
  }

  function getAudioFiles(tour: TourLink): string[] {
    const offlineFiles = tour.offline?.files?.map((file) => file.path).filter(Boolean) ?? [];
    if (offlineFiles.length) return offlineFiles;
    const points = Array.isArray(tour.raw?.points) ? tour.raw.points : [];
    return points
      .map((point) => {
        if (!point || typeof point !== "object") return undefined;
        const audio = (point as { audio?: unknown }).audio;
        return typeof audio === "string" ? audio : undefined;
      })
      .filter((audio): audio is string => typeof audio === "string" && audio.length > 0);
  }

  async function requestDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;

    const audioFiles = getAudioFiles(tour);
    if (audioFiles.length === 0) return;

    setState(tour.id, {
      status: "downloading",
      bytes: tour.offline?.totalBytes,
      downloadedBytes: 0,
      progress: 0,
      stage: "preparing",
      completedFiles: 0,
      totalFiles: audioFiles.length + 1,
      currentIndex: 0,
      currentUrl: undefined,
      lastUpdate: Date.now(),
      lastAnnouncedAt: undefined,
      lastAnnouncedProgress: undefined,
      screenreaderText: undefined,
      errorMessage: undefined,
      cacheResult: undefined
    });

    const backgroundPath = `media/tours/${tour.slug}/background.webp`;
    const downloadFiles = [...audioFiles, backgroundPath];
    const jsonPayload = JSON.stringify(tour.raw);

    console.info("[offline] user requested tour download", {
      id: tour.id,
      slug: tour.slug,
      files: audioFiles.length
    });

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "download-tour",
      payload: {
        id: tour.id,
        slug: tour.slug,
        files: downloadFiles,
        json: jsonPayload
      }
    });
  }

  async function deleteDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "delete-tour", id: tour.id });
    setState(tour.id, { status: "idle", bytes: tour.offline?.totalBytes });
  }

  async function resetDownload(tour: TourLink, restart = false) {
    if (!browser || !("caches" in window)) return;
    const cacheName = `${TOUR_CACHE_PREFIX}${tour.id}`;
    await caches.delete(cacheName);
    setState(tour.id, { status: "idle", bytes: tour.offline?.totalBytes });
    if (restart) {
      await requestDownload(tour);
    }
  }

  async function verifyDownloads() {
    if (!browser || !("caches" in window)) return;
    const downloadingTours = tours.filter((tour) => downloadState[tour.id]?.status === "downloading");

    await Promise.all(
      downloadingTours.map(async (tour) => {
        const cacheName = `${TOUR_CACHE_PREFIX}${tour.id}`;
        try {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          if (keys.length === 0) {
            const prev = downloadState[tour.id];
            const label = `Descarga de ${tour.name}`;
            const updated = {
              ...(prev ?? {}),
              status: "error",
              stage: "error",
              errorMessage: "Descarga detenida. Podés reintentar.",
              lastUpdate: Date.now()
            } satisfies DownloadState;
            const announcer = updateScreenreaderText(prev, updated, label, 0);
            setState(tour.id, { ...updated, ...announcer });
          }
        } catch (err) {
          console.error("Failed to verify cache", err);
        }
      })
    );
  }

  onMount(() => {
    loadState();
    now = Date.now();
    const tick = window.setInterval(() => {
      now = Date.now();
    }, 1000);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "tour-downloaded") {
          const tourId = data.id as string;
          const bytes = tours.find((t) => t.id === tourId)?.offline?.totalBytes;
          setState(tourId, {
            status: "downloaded",
            bytes,
            progress: 100,
            stage: "done",
            downloadedBytes: bytes,
            lastUpdate: Date.now(),
            cacheResult: data.result as
              | { okCount: number; failCount: number; failedUrls: string[] }
              | undefined
          });
        }
        if (data.type === "tour-deleted") {
          const tourId = data.id as string;
          const bytes = tours.find((t) => t.id === tourId)?.offline?.totalBytes;
          setState(tourId, { status: "idle", bytes });
        }
        if (data.type === "tour-progress") {
          const tourId = data.id as string;
          const prev = downloadState[tourId];
          const tour = getTourById(tourId);
          const totalFiles =
            typeof data.total === "number"
              ? data.total
              : tour?.offline?.files?.length ?? prev?.totalFiles ?? 0;
          const completedFiles =
            typeof data.completed === "number" ? data.completed : prev?.completedFiles ?? 0;
          const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
          const bytesTotal = tour?.offline?.totalBytes;
          const downloadedBytes =
            bytesTotal && totalFiles > 0 ? Math.round((completedFiles / totalFiles) * bytesTotal) : 0;
          const stage = (data.stage as DownloadState["stage"]) ?? "downloading";
          const errorMessage = typeof data.error === "string" ? data.error : undefined;
          const currentIndex =
            typeof data.currentIndex === "number" ? data.currentIndex : prev?.currentIndex;
          const currentUrl = typeof data.currentUrl === "string" ? data.currentUrl : prev?.currentUrl;
          const nextState: DownloadState = {
            ...(prev ?? {}),
            status: "downloading",
            bytes: bytesTotal ?? prev?.bytes,
            downloadedBytes,
            progress,
            stage,
            completedFiles,
            totalFiles,
            currentIndex,
            currentUrl,
            lastUpdate: Date.now(),
            errorMessage
          };
          const label = `Descarga de ${tour?.name ?? "tour"}`;
          const announcer = updateScreenreaderText(prev, nextState, label, progress);
          setState(tourId, { ...nextState, ...announcer });
        }
      });
    }

    void verifyDownloads();

    return () => {
      if (unsubscribeStore) {
        unsubscribeStore();
      }
      window.clearInterval(tick);
    };
  });
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {liveMessage}
    </div>
    <h1 class="hero-title">Explorar recorridos</h1>
    <p class="hero-subtitle">
      Recomendación: descargá el recorrido antes de salir del Wi-Fi o de una buena conexión de datos.
    </p>

    <div class="tour-list">
      {#if tours.length === 0}
        <p class="empty-state">Todavía no hay recorridos configurados.</p>
      {:else}
        {#each tours as tour}
          <TourCard
            base={appBase}
            tour={tour}
            state={downloadState[tour.id]}
            onRequestDownload={requestDownload}
            onDeleteDownload={deleteDownload}
            onResetDownload={resetDownload}
            isStalled={isStalled}
            showTestBadge={devMode && tour.status === "test"}
          />
        {/each}
      {/if}
    </div>
  </main>
</div>
