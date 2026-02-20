<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { base } from "$app/paths";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import MovementIndicator from "$lib/components/MovementIndicator.svelte";
  import { getDevModeFromStorage, getTourRecords, type TourJson as StoredTourJson } from "$lib/data/tours";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
  import type { DownloadState } from "$lib/stores/offline";
  import { playTrackingOff, playTrackingOn } from "$lib/utils/earcons";
  import { isWakeLockSupported, releaseWakeLock, requestWakeLock } from "$lib/utils/wakeLock";

  type Point = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    alt: number;
    radius: number;
    audio: string;
  };

  type OfflineFile = { path: string; bytes: number };
  type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

  type Tour = {
    id: string;
    slug: string;
    name: string;
    points: Point[];
    offline?: OfflineManifest;
    raw: StoredTourJson;
  };

  const DEFAULT_TRIGGER_RADIUS_METERS = 10;
  const MAX_EFFECTIVE_RADIUS_METERS = 25;
  const ACCURACY_MULTIPLIER = 1.5;
  const POOR_ACCURACY_THRESHOLD_METERS = 20;
  const MAX_ACCURACY_FOR_TRIGGER_METERS = 50;
  const MOTION_DISTANCE_METERS = 8;
  const MOTION_STILL_METERS = 3;
  const MOTION_WINDOW_MS = 12000;

  let devMode = false;
  let tours: Tour[] = [];
  let tourMap: Record<string, Tour> = {};
  let title = "Recorrido no encontrado";
  let points: Point[] = [];
  let selectedTour: Tour | undefined = undefined;
  let downloadState: Record<string, DownloadState> = {};
  let unsubscribeStore: (() => void) | null = null;
  let removeSwListener: (() => void) | null = null;
  let isOfflineReady = false;

  const appBase = base;

  $: devMode = browser ? getDevModeFromStorage() : false;

  $: tours = getTourRecords(devMode)
    .map(({ id, slug, data }) => {
      const name = typeof data.name === "string" ? data.name : slug;
      const points = Array.isArray(data.points) ? (data.points as Point[]) : [];
      const offline = data.offline;

      return { id, slug, name, points, offline, raw: data };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  $: tourMap = tours.reduce<Record<string, Tour>>((acc, tour) => {
    acc[tour.slug] = tour;
    acc[tour.id] = tour;
    return acc;
  }, {});

  $: {
    const track = $page.params.track;
    const fallbackTour = tours[0];
    const currentTour = track ? tourMap[track] : fallbackTour;
    selectedTour = currentTour ?? undefined;
    title = currentTour?.name ?? "Recorrido no encontrado";
    points = currentTour?.points ?? [];
  }

  $: isOfflineReady = Boolean(
    selectedTour?.id && downloadState[selectedTour.id]?.status === "downloaded"
  );
  $: tourSlug = selectedTour?.slug ?? selectedTour?.id ?? "";
  $: backgroundUrl = tourSlug ? `${appBase}/media/tours/${tourSlug}/background.webp` : "";
  let resolvedBackgroundUrl = "";
  let backgroundImage = "linear-gradient(160deg, rgba(10, 30, 22, 0.9), rgba(22, 44, 34, 0.7))";
  let backgroundRequestId = 0;
  $: downloadStatus = selectedTour?.id ? downloadState[selectedTour.id] : undefined;

  // Estado general
  let isTracking = false;
  let statusMessage = "Listo para iniciar el recorrido";
  let isWakeLockActive = false;
  let isWakeLockAvailable = false;
  let wakeLockStatusLine = "";

  // Posición actual
  let currentLat: number | null = null;
  let currentLng: number | null = null;
  let currentAccuracy: number | null = null;
  let currentEffectiveRadius: number | null = null;
  let gpsWarningMessage: string | null = null;
  let isMoving = false;
  let lastMotionSample: { lat: number; lng: number; time: number } | null = null;

  // Distancias dinámicas
  let distanceToFirstMeters: number | null = null;
  let pointDistances: Record<string, number> = {};

  // Geolocation watch id
  let watchId: number | null = null;

  // Puntos disparados
  let triggeredPointIds: string[] = [];
  let lastTriggeredPoint: Point | null = null;
  let lastTriggerEvalPointId: string | null = null;
  let lastTriggerEvalEffectiveRadius: number | null = null;
  let lastTriggerEvalInsideRadius: boolean | null = null;
  let lastTriggeredAccuracy: number | null = null;
  let lastTriggeredEffectiveRadius: number | null = null;
  let lastTriggeredInsideRadius: boolean | null = null;

  let nextArmedPoint: Point | null = null;
  let distanceToNextPointMeters: number | null = null;
  let lastManualScrollAt = 0;
  let lastAutoScrollId: string | null = null;
  let activePointId: string | null = null;
  const pointRefs: Record<string, HTMLElement | null> = {};
  const MANUAL_SCROLL_GUARD_MS = 2000;
  const STICKY_SCROLL_MAX = 60;
  const STICKY_ALPHA_MIN = 0.35;
  const STICKY_ALPHA_MAX = 0.9;
  let stickyHeaderEl: HTMLDivElement | null = null;
  let stickyRaf = 0;
  let removeStickyScroll: (() => void) | null = null;
  let removeVisibilityListener: (() => void) | null = null;
  let removeWakeLockReleaseListener: (() => void) | null = null;

  function registerPoint(node: HTMLElement, id: string) {
    pointRefs[id] = node;
    return {
      destroy() {
        if (pointRefs[id] === node) {
          delete pointRefs[id];
        }
      }
    };
  }

  function markManualScroll() {
    lastManualScrollAt = Date.now();
  }

  function updateStickyVars(scrollTop: number) {
    if (!stickyHeaderEl) return;
    const factor = Math.min(1, Math.max(0, scrollTop / STICKY_SCROLL_MAX));
    const alpha = STICKY_ALPHA_MIN + (STICKY_ALPHA_MAX - STICKY_ALPHA_MIN) * factor;
    stickyHeaderEl.style.setProperty("--stickyAlpha", alpha.toFixed(3));
    stickyHeaderEl.style.setProperty("--stickyShadowAlpha", factor.toFixed(3));
    stickyHeaderEl.style.setProperty("--stickyBorderAlpha", factor.toFixed(3));
  }

  function disableStickyScroll() {
    if (removeStickyScroll) {
      removeStickyScroll();
      removeStickyScroll = null;
    }
    updateStickyVars(0);
  }

  function enableStickyScroll() {
    if (!browser || !stickyHeaderEl) return;
    disableStickyScroll();

    const onScroll = () => {
      if (stickyRaf) return;
      stickyRaf = requestAnimationFrame(() => {
        stickyRaf = 0;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        updateStickyVars(scrollTop);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    removeStickyScroll = () => {
      window.removeEventListener("scroll", onScroll);
      if (stickyRaf) {
        cancelAnimationFrame(stickyRaf);
        stickyRaf = 0;
      }
    };
  }

  function resolveBackground(url: string) {
    if (!browser) {
      resolvedBackgroundUrl = "";
      backgroundImage = "linear-gradient(160deg, rgba(10, 30, 22, 0.9), rgba(22, 44, 34, 0.7))";
      return;
    }
    backgroundRequestId += 1;
    const requestId = backgroundRequestId;
    if (!url) {
      resolvedBackgroundUrl = "";
      backgroundImage = "linear-gradient(160deg, rgba(10, 30, 22, 0.9), rgba(22, 44, 34, 0.7))";
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (requestId !== backgroundRequestId) return;
      resolvedBackgroundUrl = url;
      backgroundImage = `linear-gradient(160deg, rgba(10, 30, 22, 0.55), rgba(22, 44, 34, 0.35)), url('${url}')`;
    };
    img.onerror = () => {
      if (requestId !== backgroundRequestId) return;
      resolvedBackgroundUrl = "";
      backgroundImage = "linear-gradient(160deg, rgba(10, 30, 22, 0.9), rgba(22, 44, 34, 0.7))";
    };
    img.src = url;
  }

  // Reproductor de audio
  let audioPlayer: HTMLAudioElement | null = null;
  let currentAudioPointId: string | null = null;
  let isAudioPlaying = false;

  function initAudioPlayer() {
    if (!audioPlayer && typeof window !== "undefined") {
      audioPlayer = new Audio();
    }
  }

  async function unlockMainAudioPlayer() {
    initAudioPlayer();
    if (!audioPlayer) return;

    // Autoplay unlock: first geo-triggered play is not a user gesture (iOS/Chrome policy).
    const previousSrc = audioPlayer.src;
    const previousTime = audioPlayer.currentTime;
    const previousMuted = audioPlayer.muted;
    const previousVolume = audioPlayer.volume;
    const unlockSrc = previousSrc || `${appBase}/media/ui/tracking-on.mp3`;

    audioPlayer.muted = true;
    audioPlayer.volume = 0;
    audioPlayer.src = unlockSrc;
    audioPlayer.currentTime = 0;

    try {
      await audioPlayer.play();
      audioPlayer.pause();
    } catch {
      // Ignore autoplay or playback failures.
    }

    audioPlayer.currentTime = 0;
    audioPlayer.muted = previousMuted;
    audioPlayer.volume = previousVolume;
    audioPlayer.src = previousSrc;
    if (previousSrc) {
      audioPlayer.currentTime = previousTime;
    }
  }

  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // metros
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(d: number | null | undefined): string {
    if (d == null || !Number.isFinite(d)) return "—";
    if (d < 1000) return `${Math.round(d)} m`;
    return `${(d / 1000).toFixed(2)} km`;
  }

  function formatMB(bytes?: number) {
    if (!bytes) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getProgressPercent(state?: DownloadState): number {
    if (!state) return 0;
    if (typeof state.progress === "number") return state.progress;
    if (state.completedFiles && state.totalFiles) {
      return Math.round((state.completedFiles / state.totalFiles) * 100);
    }
    return 0;
  }

  function getAudioFiles(tour: Tour): string[] {
    const offlineFiles = tour.offline?.files?.map((file) => file.path).filter(Boolean) ?? [];
    if (offlineFiles.length) return offlineFiles;
    return tour.points
      .map((point) => point.audio)
      .filter((audio) => typeof audio === "string" && audio.length > 0);
  }

  async function requestDownload(tour: Tour) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const audioFiles = getAudioFiles(tour);
    if (audioFiles.length === 0) return;

    setDownloadState(tour.id, {
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

  async function deleteDownload(tour: Tour) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "delete-tour", id: tour.id });
    setDownloadState(tour.id, { status: "idle", bytes: tour.offline?.totalBytes });
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function getEffectiveRadius(accuracy: number): number {
    const scaled = Math.max(DEFAULT_TRIGGER_RADIUS_METERS, accuracy * ACCURACY_MULTIPLIER);
    return clamp(scaled, DEFAULT_TRIGGER_RADIUS_METERS, MAX_EFFECTIVE_RADIUS_METERS);
  }

  async function playPointAudio(point: Point) {
    initAudioPlayer();
    if (!audioPlayer) return;

    // Detener cualquier audio previo y preparar el nuevo
    audioPlayer.pause();
    audioPlayer.src = point.audio;
    audioPlayer.currentTime = 0;

    currentAudioPointId = point.id;

    try {
      await audioPlayer.play();
      isAudioPlaying = true;
      statusMessage = `Reproduciendo: ${point.name}`;
    } catch (err) {
      console.error("Error al reproducir audio", err);
      isAudioPlaying = false;
      statusMessage =
        "No se pudo reproducir el audio (quizás el navegador bloqueó la reproducción automática o el archivo no está disponible).";
    }

    if (audioPlayer) {
      audioPlayer.onended = () => {
        isAudioPlaying = false;
      };
    }
  }

  async function togglePlayPoint(point: Point) {
    initAudioPlayer();
    if (!audioPlayer) return;

    // Si el mismo punto está sonando actualmente
    if (currentAudioPointId === point.id) {
      if (isAudioPlaying) {
        audioPlayer.pause();
        isAudioPlaying = false;
        statusMessage = `Pausado: ${point.name}`;
      } else {
        try {
          await audioPlayer.play();
          isAudioPlaying = true;
          statusMessage = `Reproduciendo: ${point.name}`;
        } catch (err) {
          console.error("Error al reanudar audio", err);
          isAudioPlaying = false;
          statusMessage =
            "No se pudo reanudar el audio (quizás el navegador bloqueó la reproducción automática o el archivo no está disponible).";
        }
      }
      return;
    }

    // Si es un punto diferente al que estaba seleccionado
    audioPlayer.pause();
    audioPlayer.src = point.audio;
    audioPlayer.currentTime = 0;
    currentAudioPointId = point.id;

    try {
      await audioPlayer.play();
      isAudioPlaying = true;
      statusMessage = `Reproduciendo: ${point.name}`;
    } catch (err) {
      console.error("Error al reproducir audio", err);
      isAudioPlaying = false;
      statusMessage =
        "No se pudo reproducir el audio (quizás el navegador bloqueó la reproducción automática o el archivo no está disponible).";
    }

    if (audioPlayer) {
      audioPlayer.onended = () => {
        isAudioPlaying = false;
      };
    }
  }

  function handlePosition(pos: GeolocationPosition) {
    const { latitude, longitude, accuracy } = pos.coords;
    const now = Date.now();

    currentLat = latitude;
    currentLng = longitude;
    currentAccuracy = accuracy;
    currentEffectiveRadius = getEffectiveRadius(accuracy);
    gpsWarningMessage = accuracy > POOR_ACCURACY_THRESHOLD_METERS ? "GPS poco preciso" : null;

    // Distancia al punto 1 del recorrido (si existe)
    if (points.length > 0) {
      distanceToFirstMeters = distanceMeters(
        latitude,
        longitude,
        points[0].lat,
        points[0].lng
      );
    } else {
      distanceToFirstMeters = null;
    }

    // Distancias a todos los puntos (para debug en listado)
    const newDistances: Record<string, number> = {};
    for (const point of points) {
      newDistances[point.id] = distanceMeters(
        latitude,
        longitude,
        point.lat,
        point.lng
      );
    }
    pointDistances = newDistances;

    if (accuracy <= POOR_ACCURACY_THRESHOLD_METERS) {
      if (!lastMotionSample) {
        lastMotionSample = { lat: latitude, lng: longitude, time: now };
      } else if (now - lastMotionSample.time >= MOTION_WINDOW_MS) {
        const moved = distanceMeters(
          lastMotionSample.lat,
          lastMotionSample.lng,
          latitude,
          longitude
        );
        if (moved >= MOTION_DISTANCE_METERS) {
          isMoving = true;
          lastMotionSample = { lat: latitude, lng: longitude, time: now };
        } else if (moved < MOTION_STILL_METERS) {
          isMoving = false;
          lastMotionSample = { lat: latitude, lng: longitude, time: now };
        }
      }
    }

    if (!isTracking) return;

    const effectiveRadius = currentEffectiveRadius;

    for (const point of points) {
      if (triggeredPointIds.includes(point.id)) continue;

      const dist = distanceMeters(latitude, longitude, point.lat, point.lng);
      if (effectiveRadius === null) continue;
      const insideRadius = dist <= effectiveRadius;
      const accuracyOk = accuracy <= MAX_ACCURACY_FOR_TRIGGER_METERS;

      lastTriggerEvalPointId = point.id;
      lastTriggerEvalEffectiveRadius = effectiveRadius;
      lastTriggerEvalInsideRadius = insideRadius;

      if (insideRadius && accuracyOk) {
        triggeredPointIds = [...triggeredPointIds, point.id];
        lastTriggeredPoint = point;
        lastTriggeredAccuracy = accuracy;
        lastTriggeredEffectiveRadius = effectiveRadius;
        lastTriggeredInsideRadius = insideRadius;
        void playPointAudio(point);
        break;
      }
    }
  }

  function handlePositionError(err: GeolocationPositionError) {
    console.error("Error de geolocalización", err);
    statusMessage = `Error de geolocalización (${err.code}): ${err.message}`;
  }

  async function syncWakeLockRequest() {
    const acquired = await requestWakeLock();
    isWakeLockActive = acquired;
  }

  async function syncWakeLockRelease() {
    await releaseWakeLock();
    isWakeLockActive = false;
  }

  function startTracking() {
    if (isTracking) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      statusMessage = "Tu navegador no soporta geolocalización";
      return;
    }

    triggeredPointIds = [];
    lastTriggeredPoint = null;
    lastTriggeredAccuracy = null;
    lastTriggeredEffectiveRadius = null;
    lastTriggeredInsideRadius = null;
    isTracking = true;
    statusMessage = "Iniciando seguimiento de ubicación…";
    void syncWakeLockRequest();
    void tick().then(() => enableStickyScroll());

    watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });
  }

  function stopTracking() {
    isTracking = false;
    statusMessage = "Seguimiento detenido";
    isMoving = false;
    lastMotionSample = null;

    if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (audioPlayer) {
      audioPlayer.pause();
    }
    currentAudioPointId = null;
    isAudioPlaying = false;
    void syncWakeLockRelease();
    disableStickyScroll();
  }

  async function toggleTracking() {
    if (isTracking) {
      void playTrackingOff();
      stopTracking();
    } else {
      await unlockMainAudioPlayer();
      startTracking();
      await playTrackingOn();
    }
  }

  $: resolveBackground(backgroundUrl);

  onMount(() => {
    if (!browser) return;
    initOfflineStore();
    unsubscribeStore = downloadStateStore.subscribe((state) => {
      downloadState = state;
    });
    isWakeLockAvailable = isWakeLockSupported();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void syncWakeLockRelease();
        return;
      }
      if (isTracking) {
        void syncWakeLockRequest();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    removeVisibilityListener = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };

    const handleWakeLockRelease = () => {
      isWakeLockActive = false;
    };
    window.addEventListener("wake-lock-release", handleWakeLockRelease);
    removeWakeLockReleaseListener = () => {
      window.removeEventListener("wake-lock-release", handleWakeLockRelease);
    };

    if ("serviceWorker" in navigator) {
      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "tour-downloaded") {
          const tourId = data.id as string;
          const bytes = tours.find((t) => t.id === tourId)?.offline?.totalBytes;
          setDownloadState(tourId, {
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
          setDownloadState(tourId, { status: "idle", bytes });
        }
        if (data.type === "tour-progress") {
          const tourId = data.id as string;
          const prev = downloadState[tourId];
          const tour = tours.find((t) => t.id === tourId);
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
          setDownloadState(tourId, nextState);
        }
      };

      navigator.serviceWorker.addEventListener("message", handleMessage);
      removeSwListener = () => {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }
  });

  onDestroy(() => {
    stopTracking();
    disableStickyScroll();
    if (removeVisibilityListener) {
      removeVisibilityListener();
    }
    if (removeWakeLockReleaseListener) {
      removeWakeLockReleaseListener();
    }
    if (removeSwListener) {
      removeSwListener();
    }
    if (unsubscribeStore) {
      unsubscribeStore();
    }
  });

  $: nextArmedPoint = points.find((point) => !triggeredPointIds.includes(point.id)) ?? null;
  $: distanceToNextPointMeters =
    nextArmedPoint && pointDistances[nextArmedPoint.id] !== undefined
      ? pointDistances[nextArmedPoint.id]
      : null;
  $: activePointId = lastTriggeredPoint?.id ?? null;
  $: if (!isTracking) {
    lastAutoScrollId = null;
  }
  $: if (isTracking && activePointId && activePointId !== lastAutoScrollId) {
    const hasRecentManualScroll = Date.now() - lastManualScrollAt < MANUAL_SCROLL_GUARD_MS;
    if (!hasRecentManualScroll) {
      const target = pointRefs[activePointId];
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    lastAutoScrollId = activePointId;
  }
  $: if (!isTracking) {
    wakeLockStatusLine = "";
  } else if (!isWakeLockAvailable) {
    wakeLockStatusLine = "Pantalla activa: no disponible en este navegador";
  } else if (isWakeLockActive) {
    wakeLockStatusLine = "Pantalla activa: sí";
  } else {
    wakeLockStatusLine = "Pantalla activa: no (podés desactivar el bloqueo automático del teléfono)";
  }
</script>

<main
  class={`ag-main track-page ${isTracking ? "is-tracking" : ""}`}
  style={`
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    padding: 0 1rem 3rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    gap: 1.5rem;
    background-color: #0f1c18;
    background-image: ${backgroundImage};
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    background-repeat: no-repeat;
  `}
>
  {#if isTracking}
    <div class="track-active-header" bind:this={stickyHeaderEl}>
      <div class="track-active-container">
        <div class="track-header track-panel track-active-row track-active-row--nav">
          <a
            class="track-back"
            href={`${appBase}/`}
            on:click={() => {
              if (isTracking) {
                void playTrackingOff();
              }
            }}
          >
            ← Menú principal
          </a>
          <span
            class={`track-pill ${isOfflineReady ? "is-offline" : "is-online"}`}
            aria-label={`Estado del recorrido: ${isOfflineReady ? "offline" : "online"}`}
            aria-live="polite"
          >
            {#if isOfflineReady}
              <svg
                class="track-status-icon"
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
              <span class="track-pill-text">Recorrido offline</span>
              <video
                class="track-offline-orb"
              src={`${appBase}/media/ui/active-orb.mp4`}
                muted
                autoplay
                loop
                playsinline
                preload="auto"
                aria-hidden="true"
              ></video>
              <span class="track-offline-orb-fallback" aria-hidden="true"></span>
            {:else}
              <svg
                class="track-status-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="currentColor" />
                <path d="M6.3 15.3a8 8 0 0 1 11.4 0l-1.4 1.4a6 6 0 0 0-8.6 0l-1.4-1.4z" fill="currentColor" />
                <path d="M3.5 12.5a12 12 0 0 1 17 0l-1.4 1.4a10 10 0 0 0-14.2 0l-1.4-1.4z" fill="currentColor" />
              </svg>
              Recorrido online
            {/if}
          </span>
        </div>

        <header class="track-panel track-active-row track-active-row--title">
          <div class="track-title-grid">
            <h1 class="track-title">{title}</h1>
            <div class="track-title-indicator">
              <MovementIndicator isTracking={isTracking} isMoving={isMoving} />
            </div>
          </div>
        </header>

        <section class="track-panel track-active-row track-active-row--status">
          <div class="track-status-stack">
            <p class="track-status-line">{statusMessage}</p>
            <p class="tracking-status" aria-live="polite">
              <span class="tracking-dot" aria-hidden="true"></span>
              Seguimiento activo
            </p>
            {#if wakeLockStatusLine}
              <p class="tracking-wakelock" aria-live="polite">{wakeLockStatusLine}</p>
            {/if}
          </div>
          <button
            on:click={toggleTracking}
            class={`btn track-btn ${isOfflineReady ? "btn-offline" : "btn-primary"}`}
            aria-label="Detener recorrido"
            aria-pressed={isTracking}
          >
            Detener recorrido
          </button>
        </section>
      </div>
    </div>
  {:else}
    <div class="track-header track-panel">
      <a
        class="track-back"
        href={`${appBase}/`}
        on:click={() => {
          if (isTracking) {
            void playTrackingOff();
          }
        }}
      >
        ← Menú principal
      </a>
      <span
        class={`track-pill ${isOfflineReady ? "is-offline" : "is-online"}`}
        aria-label={`Estado del recorrido: ${isOfflineReady ? "offline" : "online"}`}
        aria-live="polite"
      >
        {#if isOfflineReady}
          <svg
            class="track-status-icon"
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
          Recorrido offline
        {:else}
          <svg
            class="track-status-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="currentColor" />
            <path d="M6.3 15.3a8 8 0 0 1 11.4 0l-1.4 1.4a6 6 0 0 0-8.6 0l-1.4-1.4z" fill="currentColor" />
            <path d="M3.5 12.5a12 12 0 0 1 17 0l-1.4 1.4a10 10 0 0 0-14.2 0l-1.4-1.4z" fill="currentColor" />
          </svg>
          Recorrido online
        {/if}
      </span>
    </div>

    <header class="track-panel">
      <h1 style="font-size: 1.8rem; margin-bottom: 0.25rem;">{title}</h1>
      <p style="max-width: 520px; margin: 0 auto; font-size: 0.95rem;">
        Para que el GPS y los audios se disparen correctamente, mantené la app abierta mientras
        caminás. Si el teléfono bloquea la pantalla, puede pausar el seguimiento.
      </p>
    </header>
  {/if}

  {#if selectedTour}
    {#if isOfflineReady}
      <section
        class="track-panel track-offline-section"
        style="
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
        "
      >
        <p class="offline-inline" style="margin: 0; font-size: 0.95rem;">
          Offline: listo · {formatMB(selectedTour.offline?.totalBytes)}
          <button
            type="button"
            class="offline-inline-link delete-link delete-inline"
            on:click={() => deleteDownload(selectedTour!)}
            aria-label="Eliminar recorrido descargado"
          >
            <span aria-hidden="true">✕</span>
            Eliminar recorrido
          </button>
        </p>
      </section>
    {:else}
      <section
        class="track-panel track-offline-section"
        style="
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.65rem;
        "
      >
        {#if downloadStatus?.status === "downloading"}
          <div style="width: 100%;">
            <div
              style="height: 6px; border-radius: 999px; background: rgba(0,0,0,0.12); overflow: hidden;"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={getProgressPercent(downloadStatus)}
            >
              <div
                style={`height: 100%; background: #0b5aa0; width: ${getProgressPercent(downloadStatus)}%;`}
              ></div>
            </div>
            <p style="margin: 0.5rem 0 0; font-size: 0.9rem;" aria-live="polite">
              Descargando audio {downloadStatus?.currentIndex ?? downloadStatus?.completedFiles ?? 0} de {downloadStatus?.totalFiles ?? 0}
              ({getProgressPercent(downloadStatus)}%)
            </p>
          </div>
        {:else}
          <p class="offline-inline" style="margin: 0; font-size: 0.95rem;" aria-live="polite">
            Offline: no descargado · {formatMB(selectedTour.offline?.totalBytes)}
            <button
              type="button"
              class="offline-inline-link"
              on:click={() => requestDownload(selectedTour!)}
              aria-label="Descargar para usar sin conexión"
            >
              <span aria-hidden="true">↓</span>
              Descargar
            </button>
          </p>
          <p style="margin: 0; font-size: 0.9rem;">
            Este recorrido no está descargado en tu dispositivo. Descargalo para usarlo sin conexión.
          </p>
        {/if}
      </section>
    {/if}
  {/if}

  {#if devMode}
    <section
      class="track-dev-section"
      style="
        width: 100%;
        max-width: 640px;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        border: 1px dashed rgba(0,0,0,0.2);
        font-size: 0.9rem;
        text-align: left;
      "
    >
      <p style="margin: 0.25rem 0;">
        track param: <strong>{$page.params.track ?? "(none)"}</strong>
      </p>
      <p style="margin: 0.25rem 0;">
        tour seleccionado: <strong>{selectedTour?.id ?? "—"}</strong> — {selectedTour?.name ?? "—"}
      </p>
      <p style="margin: 0.25rem 0;">
        tours encontrados ({tours.length}): {tours.map((t) => `${t.id} (${t.name})`).join(", ")}
      </p>
    </section>
  {/if}

  {#if !isTracking}
    <section
      class="track-panel track-start-section"
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      "
    >
      <button
        on:click={toggleTracking}
        class={`btn track-btn ${isOfflineReady ? "btn-offline" : "btn-primary"}`}
        aria-label="Iniciar recorrido"
        aria-pressed={isTracking}
      >
        Iniciar recorrido
      </button>

      <p style="font-size: 0.9rem; max-width: 420px; margin: 0;">
        {statusMessage}
      </p>
      {#if devMode}
        <p style="font-size: 0.75rem; margin: 0; opacity: 0.75;">
          Acc: {currentAccuracy !== null ? Math.round(currentAccuracy) : "—"} m ·
          Radio: {currentEffectiveRadius !== null ? Math.round(currentEffectiveRadius) : "—"} m ·
          Distancia siguiente: {distanceToNextPointMeters !== null ? Math.round(distanceToNextPointMeters) : "—"} m ·
          Armado: {nextArmedPoint ? `${nextArmedPoint.id} (${nextArmedPoint.name})` : "—"}
        </p>
      {/if}
    </section>
  {/if}

  <section
    class="track-panel track-points-section"
    style="
      width: 100%;
      max-width: 640px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      text-align: left;
      margin-top: 1rem;
    "
  >
    <div
      style="
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(0,0,0,0.1);
      "
    >
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Puntos del recorrido</h2>
      <ul
        style="list-style: none; padding: 0; margin: 0;"
        on:wheel={markManualScroll}
        on:touchmove={markManualScroll}
      >
        {#each points as point}
          <li
            use:registerPoint={point.id}
            aria-current={point.id === activePointId ? "true" : undefined}
            style="
              font-size: 0.85rem;
              padding: 0.6rem 0;
              min-height: 52px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 0.5rem;
            "
          >
            <span>
              {point.id}: {point.name}
            </span>

            <span
              style="
                display: flex;
                align-items: center;
                gap: 0.35rem;
              "
            >
              <button
                type="button"
                on:click={() => togglePlayPoint(point)}
                aria-label={`${currentAudioPointId === point.id && isAudioPlaying ? "Pausar" : "Reproducir"} punto: ${point.name}`}
                style="
                  border: none;
                  border-radius: 999px;
                  padding: 0.45rem 0.9rem;
                  min-width: 44px;
                  min-height: 44px;
                  font-size: 0.75rem;
                  cursor: pointer;
                  background: #ffffff;
                  box-shadow: 0 0 0 1px rgba(0,0,0,0.12);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                {#if currentAudioPointId === point.id && isAudioPlaying}
                  ⏸
                {:else}
                  ▶︎
                {/if}
              </button>

              <span style="font-size: 0.8rem;">
                {#if pointDistances[point.id] !== undefined}
                  {formatDistance(pointDistances[point.id])}
                {:else}
                  —
                {/if}
              </span>

              <span>
                {#if triggeredPointIds.includes(point.id)}
                  ✅
                {:else}
                  ⚪️
                {/if}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <section
    class="track-panel track-debug-section"
    style="
      width: 100%;
      max-width: 640px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      text-align: left;
      margin-top: 1rem;
    "
  >
    <div
      class="track-panel"
      style="
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(0,0,0,0.1);
      "
    >
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Posición actual (debug)</h2>
      {#if currentLat !== null && currentLng !== null}
        <p style="font-size: 0.9rem; margin: 0.1rem 0;">
          Lat: {currentLat}
        </p>
        <p style="font-size: 0.9rem; margin: 0.1rem 0;">
          Lng: {currentLng}
        </p>
        {#if currentAccuracy !== null}
          <p style="font-size: 0.9rem; margin: 0.1rem 0;">
            Precisión aprox.: {Math.round(currentAccuracy)} m
          </p>
        {/if}
        {#if gpsWarningMessage}
          <p style="font-size: 0.9rem; margin: 0.1rem 0; color: #c0392b;">
            {gpsWarningMessage}
          </p>
        {/if}
        {#if distanceToFirstMeters !== null}
          <p style="font-size: 0.9rem; margin: 0.1rem 0;">
            Distancia al punto 1 del recorrido: {formatDistance(distanceToFirstMeters)}
          </p>
        {/if}
        {#if lastTriggerEvalEffectiveRadius !== null && lastTriggerEvalInsideRadius !== null}
          <p style="font-size: 0.9rem; margin: 0.1rem 0;">
            Radio efectivo ({lastTriggerEvalPointId ?? "—"}): {Math.round(lastTriggerEvalEffectiveRadius)} m
          </p>
          <p style="font-size: 0.9rem; margin: 0.1rem 0;">
            Inside radius: {lastTriggerEvalInsideRadius ? "sí" : "no"}
          </p>
        {/if}
      {:else}
        <p style="font-size: 0.9rem; margin: 0;">
          Todavía no se recibió ninguna posición.
        </p>
      {/if}
    </div>

    <div
      style="
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(0,0,0,0.1);
      "
    >
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Último punto disparado</h2>
      {#if lastTriggeredPoint}
        <p style="font-size: 0.95rem; margin: 0.1rem 0;">
          <strong>{lastTriggeredPoint.name}</strong>
        </p>
        <p style="font-size: 0.85rem; margin: 0.1rem 0%;">
          ID: {lastTriggeredPoint.id} — Radio: {lastTriggeredPoint.radius} m
        </p>
        {#if lastTriggeredAccuracy !== null && lastTriggeredEffectiveRadius !== null}
          <p style="font-size: 0.85rem; margin: 0.1rem 0;">
            Accuracy: {Math.round(lastTriggeredAccuracy)} m — Radio efectivo: {Math.round(lastTriggeredEffectiveRadius)} m
          </p>
        {/if}
        {#if lastTriggeredInsideRadius !== null}
          <p style="font-size: 0.85rem; margin: 0.1rem 0;">
            Inside radius: {lastTriggeredInsideRadius ? "sí" : "no"}
          </p>
        {/if}
      {:else}
        <p style="font-size: 0.9rem; margin: 0;">
          Aún no se disparó ningún punto.
        </p>
      {/if}
    </div>
  </section>
</main>

<style>
  .track-page .offline-inline {
    color: #ffffff;
  }

  .track-page .offline-inline-link {
    color: #ffffff;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-decoration: none;
  }

  .track-page .offline-inline-link span[aria-hidden="true"] {
    display: inline-block;
    margin-right: 0.35rem;
  }

  .track-page .delete-inline {
    padding-left: 0.75rem;
    min-height: 44px;
  }

  .track-page .offline-inline-link:hover,
  .track-page .offline-inline-link:focus-visible {
    text-decoration: underline;
  }

  .track-page .track-pill {
    padding-right: 0.35rem;
  }

  .track-active-header {
    --stickyAlpha: 0.35;
    --stickyShadowAlpha: 0;
    --stickyBorderAlpha: 0;
    position: sticky;
    top: 0;
    z-index: 3;
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, var(--stickyAlpha));
    border-bottom: 1px solid rgba(255, 255, 255, var(--stickyBorderAlpha));
    box-shadow: 0 6px 18px rgba(0, 0, 0, var(--stickyShadowAlpha));
  }

  .track-active-container {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .track-pill-text {
    display: inline-flex;
    align-items: center;
  }

  .track-offline-orb {
    width: 12px;
    height: 12px;
    margin-left: 0.5rem;
    border-radius: 999px;
    object-fit: cover;
    flex: 0 0 auto;
  }

  .track-offline-orb-fallback {
    display: none;
    width: 8px;
    height: 8px;
    margin-left: 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.7);
    flex: 0 0 auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .track-offline-orb {
      display: none;
    }

    .track-offline-orb-fallback {
      display: inline-block;
    }
  }

  .track-page.is-tracking .track-active-header .track-panel {
    background: rgba(0, 0, 0, var(--stickyAlpha));
    padding-left: 0;
    padding-right: 0;
  }

  .track-page.is-tracking .track-active-header .track-header {
    margin: 0;
    max-width: none;
    width: 100%;
  }

  .track-active-row--nav {
    margin-bottom: 0;
    padding: 0.7rem 0;
  }

  .track-active-row--title {
    padding: 1.25rem 0;
  }

  .track-title-grid {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
    align-items: center;
    gap: 1rem;
  }

  .track-title {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.2;
    text-align: left;
  }

  .track-title-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .track-active-row--status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    text-align: left;
    padding: 0.95rem 0;
  }

  .track-status-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .track-status-line {
    margin: 0;
    font-size: 0.9rem;
  }

  .tracking-status,
  .tracking-wakelock {
    margin: 0;
    font-size: 0.85rem;
  }

  .tracking-wakelock {
    color: rgba(255, 255, 255, 0.78);
  }

  .track-page.is-tracking .track-active-header {
    order: 0;
  }

  .track-page.is-tracking .track-points-section {
    order: 1;
  }

  .track-page.is-tracking .track-offline-section {
    order: 2;
  }

  .track-page.is-tracking .track-dev-section {
    order: 3;
  }

  .track-page.is-tracking .track-debug-section {
    order: 4;
  }

  .track-page li[aria-current="true"] {
    border-radius: 0.5rem;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }
</style>
