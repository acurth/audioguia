<script lang="ts">
  import { base } from "$app/paths";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
  import type { DownloadState } from "$lib/stores/offline";
  import TourCard from "$lib/components/TourCard.svelte";

  type Point = {
    lat?: number;
    lng?: number;
  };

  type OfflineFile = { path: string; bytes: number };
  type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

  type TourJson = {
    id?: string;
    slug?: string;
    name?: string;
    points?: Point[];
    offline?: OfflineManifest;
  };

  type TourRuntime = {
    id: string;
    slug: string;
    name: string;
    points: Point[];
    ctaLabel: string;
    sizeBytes?: number;
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

  const tours: TourRuntime[] = Object.entries(tourModules).map(([path, data]) => {
    const filename = path.split("/").pop() ?? "";
    const idFromFile = filename.replace(".json", "");
    const id = typeof data.id === "string" ? data.id : idFromFile;
    const slug = typeof data.slug === "string" ? data.slug : id;
    const name = labelOverrides[id] ?? (typeof data.name === "string" ? data.name : id);
    const ctaLabel = ctaLabelOverrides[id] ?? "Abrir tour";
    const points = Array.isArray(data.points) ? data.points : [];
    return {
      id,
      slug,
      name,
      points,
      ctaLabel,
      sizeBytes: data.offline?.totalBytes,
      offline: data.offline,
      raw: data
    };
  });

  type LocationStatus = "loading" | "ready" | "denied" | "error";
  let locationStatus: LocationStatus = "loading";
  let locationMessage = "";
  let userPosition: { lat: number; lng: number } | null = null;
  let downloadState: Record<string, DownloadState> = {};
  let sortedTours: Array<TourRuntime & { distance: number }> = [];
  let unsubscribeStore: (() => void) | null = null;

  const ANNOUNCE_INTERVAL_MS = 2000;
  const STALL_TIMEOUT_MS = 30000;

  const appBase = base;

  function toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  function getDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    const R = 6371000;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(distance: number) {
    if (distance < 1000) {
      return `a ~${Math.round(distance)} m`;
    }
    return `a ~${(distance / 1000).toFixed(1)} km`;
  }

  function setState(
    id: string,
    next: Partial<DownloadState>
  ) {
    setDownloadState(id, next);
  }

  function getTourById(id: string) {
    return tours.find((tour) => tour.id === id);
  }

  function getStageLabel(stage?: string): string {
    if (stage === "preparing") return "Preparando…";
    if (stage === "saving") return "Guardando para uso offline…";
    if (stage === "done") return "Listo";
    if (stage === "error") return "Error en la descarga";
    return "Descargando audios…";
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

  async function requestDownload(tour: TourRuntime) {
    if (!browser || !("serviceWorker" in navigator)) return;
    setState(tour.id, {
      status: "downloading",
      bytes: tour.offline?.totalBytes,
      downloadedBytes: 0,
      progress: 0,
      stage: "preparing",
      completedFiles: 0,
      totalFiles: tour.offline?.files?.length ?? 0,
      currentIndex: 0,
      currentUrl: undefined,
      lastUpdate: Date.now(),
      lastAnnouncedAt: undefined,
      lastAnnouncedProgress: undefined,
      screenreaderText: undefined,
      errorMessage: undefined,
      cacheResult: undefined
    });

    const files = tour.offline?.files?.map((f) => f.path) ?? [];
    const jsonPayload = JSON.stringify(tour.raw);

    console.info("[offline] user requested tour download", {
      id: tour.id,
      slug: tour.slug,
      files: files.length
    });

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

  async function deleteDownload(tour: TourRuntime) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "delete-tour", id: tour.id });
    setState(tour.id, { status: "idle", bytes: tour.offline?.totalBytes });
  }

  async function resetDownload(tour: TourRuntime, restart = false) {
    if (!browser || !("caches" in window)) return;
    const cacheName = `audioguia-tour-${tour.id}`;
    await caches.delete(cacheName);
    setState(tour.id, { status: "idle", bytes: tour.offline?.totalBytes });
    if (restart) {
      await requestDownload(tour);
    }
  }

  function isStalled(state?: { lastUpdate?: number; status?: string }) {
    if (!state || state.status !== "downloading") return false;
    const lastUpdate = state.lastUpdate ?? 0;
    return Date.now() - lastUpdate > STALL_TIMEOUT_MS;
  }

  $: {
    if (!userPosition) {
      sortedTours = [];
    } else {
      const position = userPosition;
      sortedTours = tours
        .map((tour) => {
          const firstPoint = tour.points[0];
          if (!firstPoint || typeof firstPoint.lat !== "number" || typeof firstPoint.lng !== "number") {
            return { ...tour, distance: Number.POSITIVE_INFINITY };
          }
          const distance = getDistanceMeters(position, {
            lat: firstPoint.lat,
            lng: firstPoint.lng
          });
          return { ...tour, distance };
        })
        .sort((a, b) => a.distance - b.distance);
    }
  }

  onMount(() => {
    if (browser) {
      initOfflineStore();
      unsubscribeStore = downloadStateStore.subscribe((state) => {
        downloadState = state;
      });
    }

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

    if (!("geolocation" in navigator)) {
      locationStatus = "error";
      locationMessage = "Tu navegador no permite obtener ubicación.";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        locationStatus = "ready";
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          locationStatus = "denied";
          locationMessage = "Necesitamos tu ubicación para mostrar recorridos cercanos.";
        } else {
          locationStatus = "error";
          locationMessage = "No pudimos obtener tu ubicación. Probá nuevamente.";
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );

    return () => {
      if (unsubscribeStore) {
        unsubscribeStore();
      }
    };
  });
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <h1 class="hero-title">Recorridos cerca de mí</h1>
    <p class="hero-subtitle">Ver recorridos disponibles según tu ubicación.</p>
    <p class="hero-subtitle">
      Recomendación: descargá el recorrido antes de salir del Wi-Fi o de una buena conexión de datos.
    </p>

    {#if locationStatus !== "ready"}
      <p class="empty-state">
        {locationStatus === "loading" ? "Buscando tu ubicación…" : locationMessage}
      </p>
    {:else}
      <div class="tour-list">
        {#each sortedTours as tour}
          <TourCard
            base={appBase}
            tour={tour}
            state={downloadState[tour.id]}
            metaText={formatDistance(tour.distance)}
            onRequestDownload={requestDownload}
            onDeleteDownload={deleteDownload}
            onResetDownload={resetDownload}
            isStalled={isStalled}
          />
        {/each}
      </div>
    {/if}
  </main>
</div>
