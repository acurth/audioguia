<script lang="ts">
  import { base } from "$app/paths";

  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  type OfflineFile = { path: string; bytes: number };
  type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

  type TourJson = {
    id?: string;
    slug?: string;
    name?: string;
    theme?: string;
    offline?: OfflineManifest;
    points?: unknown[];
  };

  type TourLink = {
    id: string;
    slug: string;
    label: string;
    theme?: string;
    offline?: OfflineManifest;
    raw: TourJson;
  };

  const tourModules = import.meta.glob("$lib/data/tours/*.json", {
    eager: true,
    import: "default"
  }) as Record<string, TourJson>;

  const labelOverrides: Record<string, string> = {
    "sendero-arrayanes-audio-01": "Sendero Arrayanes – Audioguía (Llao Llao)",
    "casa-test-01": "Casa – Tour de prueba"
  };

  const ctaLabelOverrides: Record<string, string> = {
    "sendero-arrayanes-audio-01": "Abrir Sendero Arrayanes Audio",
    "casa-test-01": "Abrir Test casa"
  };

  const tours: TourLink[] = Object.entries(tourModules)
    .map(([path, data]) => {
      const filename = path.split("/").pop() ?? "";
      const idFromFile = filename.replace(".json", "");

      const id = typeof data.id === "string" ? data.id : idFromFile;
      const slug = typeof data.slug === "string" ? data.slug : id;
      const label = labelOverrides[id] ?? (typeof data.name === "string" ? data.name : id);
      const theme = typeof data.theme === "string" ? data.theme : undefined;
      const offline = data.offline;

      return { id, slug, label, theme, offline, raw: data };
    })
    .sort((a, b) => {
      const aIsTest = /test|casa/i.test(a.id);
      const bIsTest = /test|casa/i.test(b.id);
      if (aIsTest !== bIsTest) return aIsTest ? 1 : -1;
      return a.label.localeCompare(b.label);
    });

  type DownloadStage = "preparing" | "downloading" | "saving" | "done" | "error";

  type DownloadState = {
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
  };

  const logoSrc = `${base}/branding/audioguia-natural-cropped.png`;
  const TOUR_CACHE_PREFIX = "audioguia-tour-";
  const STALL_TIMEOUT_MS = 30000;
  const ANNOUNCE_STEP = 10;
  const ANNOUNCE_INTERVAL_MS = 15000;

  let downloadState: Record<string, DownloadState> = {};
  let announcedReady: Record<string, boolean> = {};
  let liveMessage = "";
  let now = Date.now();

  function loadState() {
    if (!browser) return;
    const stored = localStorage.getItem("offline-downloads");
    if (stored) {
      try {
        downloadState = JSON.parse(stored);
        announcedReady = Object.fromEntries(
          Object.entries(downloadState)
            .filter(([, state]) => state?.status === "downloaded")
            .map(([id]) => [id, true])
        );
      } catch (err) {
        console.error("Failed to parse offline state", err);
      }
    }
  }

  function persistState() {
    if (!browser) return;
    localStorage.setItem("offline-downloads", JSON.stringify(downloadState));
  }

  function formatMB(bytes?: number) {
    if (!bytes) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setState(id: string, next: DownloadState) {
    downloadState = { ...downloadState, [id]: next };
    persistState();
  }

  function getStageLabel(stage?: DownloadStage): string {
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

  $: {
    for (const tour of tours) {
      if (downloadState[tour.id]?.status === "downloaded" && !announcedReady[tour.id]) {
        liveMessage = `Tour listo sin conexión: ${tour.label}`;
        announcedReady = { ...announcedReady, [tour.id]: true };
      }
    }
  }

  function getDownloadedBytes(state: DownloadState | undefined, totalBytes?: number): number | undefined {
    if (!state || !totalBytes) return undefined;
    if (typeof state.downloadedBytes === "number") return state.downloadedBytes;
    const percent = getProgressPercent(state);
    return Math.round((percent / 100) * totalBytes);
  }

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
    const lastProgress = prev?.lastAnnouncedProgress ?? -ANNOUNCE_STEP;
    const lastAnnouncedAt = prev?.lastAnnouncedAt ?? 0;
    const elapsed = Date.now() - lastAnnouncedAt;
    const shouldAnnounceProgress =
      progress - lastProgress >= ANNOUNCE_STEP || elapsed >= ANNOUNCE_INTERVAL_MS;

    const stageChanged = prev?.stage !== next.stage;
    const shouldAnnounceStage = stageChanged && next.stage !== "downloading";

    if (next.errorMessage) {
      return {
        screenreaderText: `${label}. ${next.errorMessage}`,
        lastAnnouncedProgress: progress,
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
        lastAnnouncedProgress: progress,
        lastAnnouncedAt: Date.now()
      };
    }

    if (shouldAnnounceProgress) {
      return {
        screenreaderText: `${label}. ${progress}% descargado.`,
        lastAnnouncedProgress: progress,
        lastAnnouncedAt: Date.now()
      };
    }

    return {
      screenreaderText: prev?.screenreaderText,
      lastAnnouncedProgress: prev?.lastAnnouncedProgress,
      lastAnnouncedAt: prev?.lastAnnouncedAt
    };
  }

  async function requestDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;

    setState(tour.id, {
      status: "downloading",
      bytes: tour.offline?.totalBytes,
      downloadedBytes: 0,
      progress: 0,
      stage: "preparing",
      completedFiles: 0,
      totalFiles: tour.offline?.files?.length ?? 0,
      lastUpdate: Date.now()
    });

    const files = tour.offline?.files?.map((f) => f.path) ?? [];
    const jsonPayload = JSON.stringify(tour.raw);

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "download-tour",
      payload: {
        id: tour.id,
        slug: tour.slug,
        files,
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
            const label = `Descarga de ${tour.label}`;
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
            lastUpdate: Date.now()
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
          const stage = (data.stage as DownloadStage) ?? "downloading";
          const errorMessage = typeof data.error === "string" ? data.error : undefined;
          const nextState: DownloadState = {
            ...(prev ?? {}),
            status: "downloading",
            bytes: bytesTotal ?? prev?.bytes,
            downloadedBytes,
            progress,
            stage,
            completedFiles,
            totalFiles,
            lastUpdate: Date.now(),
            errorMessage
          };
          const label = `Descarga de ${tour?.label ?? "tour"}`;
          const announcer = updateScreenreaderText(prev, nextState, label, progress);
          setState(tourId, { ...nextState, ...announcer });
        }
      });
    }

    void verifyDownloads();

    return () => {
      window.clearInterval(tick);
    };
  });
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <header class="hero">
    <img src={logoSrc} alt="Audioguía Natural" class="hero-logo" />

    <h1 class="hero-title">Audioguía Natural — Senderos para escuchar</h1>

    <p class="hero-blurb">
      Una audioguía accesible para recorrer senderos naturales a través del sonido. Pensada para
      personas ciegas, abierta a todo público.
    </p>
  </header>

  <main id="main" class="content">
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {liveMessage}
    </div>
    <p class="hero-subtitle">
      Elegí un recorrido para empezar a caminar con audio guiado. Se recomienda descargar el tour
      antes de salir del Wi-Fi o de una buena conexión de datos.
    </p>

    <div class="tour-list">
      {#if tours.length === 0}
        <p class="empty-state">Todavía no hay recorridos configurados.</p>
      {:else}
        {#each tours as tour}
          <article
            class="tour-card"
            class:offline-ready={downloadState[tour.id]?.status === "downloaded"}
          >
            <div class="tour-card-inner">
              <div class="tour-top">
                <h2 class="sr-only">{tour.label}</h2>
                <div class="tour-actions">
                  <a
                    href={`${base}/${tour.slug}`}
                    class="btn btn-primary tour-cta"
                    aria-label={ctaLabelOverrides[tour.id] ?? "Abrir tour"}
                  >
                    {ctaLabelOverrides[tour.id] ?? "Abrir tour"}
                  </a>
                </div>
              </div>

              <div class="tour-bottom">
                <p
                  class="offline-status"
                  class:offline-ready={downloadState[tour.id]?.status === "downloaded"}
                >
                  {#if downloadState[tour.id]?.status === "downloaded"}
                    <span class="offline-ready-icon" aria-hidden="true">✓</span>
                  {/if}
                  Offline:
                  {#if downloadState[tour.id]?.status === "downloaded"}
                    listo
                  {:else if downloadState[tour.id]?.status === "downloading"}
                    descargando {getProgressPercent(downloadState[tour.id])}%
                  {:else if downloadState[tour.id]?.status === "error"}
                    {downloadState[tour.id]?.errorMessage ?? "error"}
                  {:else}
                    no descargado
                  {/if}
                  {#if tour.offline?.totalBytes}
                    · {#if downloadState[tour.id]?.status === "downloading"}
                      {formatMB(getDownloadedBytes(downloadState[tour.id], tour.offline?.totalBytes))}
                      de {formatMB(tour.offline?.totalBytes)}
                    {:else}
                      {formatMB(tour.offline?.totalBytes)}
                    {/if}
                  {/if}
                  <span class="offline-action">
                    {#if downloadState[tour.id]?.status === "downloaded"}
                      <button
                        type="button"
                        on:click={() => deleteDownload(tour)}
                        class="btn-link offline-action-btn"
                        aria-label={`Eliminar descarga del tour: ${tour.label}`}
                      >
                        <svg
                          class="offline-action-icon"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2z"
                            fill="currentColor"
                          />
                        </svg>
                        Eliminar
                      </button>
                    {:else if downloadState[tour.id]?.status !== "downloading" && downloadState[tour.id]?.status !== "error"}
                      <button
                        type="button"
                        on:click={() => requestDownload(tour)}
                        class="btn-link offline-action-btn"
                        aria-label={`Descargar tour: ${tour.label}`}
                      >
                        <svg
                          class="offline-action-icon"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3 1.4 1.42L12 17.41l-4.7-4.7 1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1zm-7 16h14v2H5v-2z"
                            fill="currentColor"
                          />
                        </svg>
                        Descargar
                      </button>
                    {/if}
                  </span>
                </p>

                {#if downloadState[tour.id]?.status === "downloading" || downloadState[tour.id]?.status === "error"}
                  <div class="offline-actions">
                    {#if downloadState[tour.id]?.status === "downloading"}
                      <button
                        type="button"
                        on:click={() => resetDownload(tour)}
                        class="btn btn-reset"
                        aria-label={`Restablecer descarga del tour ${tour.label}`}
                      >
                        Restablecer
                      </button>
                      {#if isStalled(downloadState[tour.id]) || downloadState[tour.id]?.errorMessage}
                        <button
                          type="button"
                          on:click={() => resetDownload(tour, true)}
                          class="btn btn-retry"
                          aria-label={`Reintentar descarga del tour ${tour.label}`}
                        >
                          Reintentar
                        </button>
                      {/if}
                    {:else}
                      <button
                        type="button"
                        on:click={() => resetDownload(tour, true)}
                        class="btn btn-retry"
                        aria-label={`Reintentar descarga del tour ${tour.label}`}
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        on:click={() => resetDownload(tour)}
                        class="btn btn-reset"
                        aria-label={`Restablecer descarga del tour ${tour.label}`}
                      >
                        Restablecer
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>

              {#if downloadState[tour.id]?.status === "downloading"}
                <div class="progress">
                  <div class="progress-header">
                    <span class="progress-label">Descargando…</span>
                    <span class="progress-percent">
                      {getProgressPercent(downloadState[tour.id])}%
                    </span>
                  </div>
                  <div
                    class="progress-bar"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={getProgressPercent(downloadState[tour.id])}
                  >
                    <div
                      class="progress-fill"
                      style={`width: ${getProgressPercent(downloadState[tour.id])}%`}
                    ></div>
                  </div>
                  <div class="progress-meta">
                    <span>{getStageLabel(downloadState[tour.id]?.stage)}</span>
                    {#if downloadState[tour.id]?.totalFiles}
                      <span class="progress-stage">
                        Audios {downloadState[tour.id]?.completedFiles ?? 0}/
                        {downloadState[tour.id]?.totalFiles}
                      </span>
                    {/if}
                  </div>
                  {#if downloadState[tour.id]?.errorMessage}
                    <p class="progress-error">{downloadState[tour.id]?.errorMessage}</p>
                  {/if}
                  {#if downloadState[tour.id]?.screenreaderText}
                    <p class="sr-only" aria-live="polite">
                      {downloadState[tour.id]?.screenreaderText}
                    </p>
                  {/if}
                </div>
              {/if}

            </div>
          </article>
        {/each}
      {/if}
    </div>
  </main>
</div>
