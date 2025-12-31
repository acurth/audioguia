<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { base } from "$app/paths";
  import { browser, dev } from "$app/environment";
  import { page } from "$app/stores";
  import MotionIndicator from "$lib/components/MotionIndicator.svelte";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
  import type { DownloadState } from "$lib/stores/offline";

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
    raw: TourJson;
  };

  type TourJson = {
    id?: string;
    slug?: string;
    name?: string;
    points?: Point[];
    offline?: OfflineManifest;
  };

  const MIN_EFFECTIVE_RADIUS_METERS = 8;
  const MAX_EFFECTIVE_RADIUS_METERS = 25;
  const ACCURACY_MULTIPLIER = 2.5;
  const POOR_ACCURACY_THRESHOLD_METERS = 20;
  const MAX_ACCURACY_FOR_TRIGGER_METERS = 50;
  const MOTION_DISTANCE_METERS = 8;
  const MOTION_STILL_METERS = 3;
  const MOTION_WINDOW_MS = 12000;

  const tourModules = import.meta.glob("$lib/data/tours/*.json", {
    eager: true,
    import: "default"
  }) as Record<string, TourJson>;

  const tours: Tour[] = Object.entries(tourModules)
    .map(([path, data]) => {
      const filename = path.split("/").pop() ?? "";
      const fallbackId = filename.replace(".json", "");

      const id = typeof data.id === "string" ? data.id : fallbackId;
      const slug = typeof data.slug === "string" ? data.slug : id;
      const name = typeof data.name === "string" ? data.name : slug;
      const points = Array.isArray(data.points) ? (data.points as Point[]) : [];
      const offline = data.offline;

      return { id, slug, name, points, offline, raw: data };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const tourMap = tours.reduce<Record<string, Tour>>((acc, tour) => {
    acc[tour.slug] = tour;
    acc[tour.id] = tour;
    return acc;
  }, {});

  let title: string = tours[0]?.name ?? "Recorrido no encontrado";
  let points: Point[] = tours[0]?.points ?? [];
  let selectedTour: Tour | undefined = tours[0];
  let downloadState: Record<string, DownloadState> = {};
  let unsubscribeStore: (() => void) | null = null;
  let removeSwListener: (() => void) | null = null;
  let wakeLock: WakeLockSentinel | null = null;
  let isOfflineReady = false;

  const appBase = base;

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
  $: downloadStatus = selectedTour?.id ? downloadState[selectedTour.id] : undefined;

  // Estado general
  let isTracking = false;
  let statusMessage = "Listo para iniciar el recorrido";

  // Posición actual
  let currentLat: number | null = null;
  let currentLng: number | null = null;
  let currentAccuracy: number | null = null;
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

  // Reproductor de audio
  let audioPlayer: HTMLAudioElement | null = null;
  let currentAudioPointId: string | null = null;
  let isAudioPlaying = false;

  function initAudioPlayer() {
    if (!audioPlayer && typeof window !== "undefined") {
      audioPlayer = new Audio();
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

  async function requestDownload(tour: Tour) {
    if (!browser || !("serviceWorker" in navigator)) return;
    if (!tour.offline?.files?.length) return;

    setDownloadState(tour.id, {
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
    const backgroundPath = `media/tours/${tour.slug}/background.webp`;
    const downloadFiles = [...files, backgroundPath];
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

  function getEffectiveRadius(accuracy: number, baseRadius: number): number {
    const scaled = Math.max(baseRadius, accuracy * ACCURACY_MULTIPLIER);
    return clamp(scaled, MIN_EFFECTIVE_RADIUS_METERS, MAX_EFFECTIVE_RADIUS_METERS);
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

    for (const point of points) {
      if (triggeredPointIds.includes(point.id)) continue;

      const dist = distanceMeters(latitude, longitude, point.lat, point.lng);
      const baseRadius = Number.isFinite(point.radius) ? point.radius : 10;
      const effectiveRadius = getEffectiveRadius(accuracy, baseRadius);
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

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return;
    try {
      await wakeLock.release();
    } catch {
      // ignore
    } finally {
      wakeLock = null;
    }
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
    void requestWakeLock();

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
    void releaseWakeLock();
  }

  function toggleTracking() {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  onMount(() => {
    if (!browser) return;
    initOfflineStore();
    unsubscribeStore = downloadStateStore.subscribe((state) => {
      downloadState = state;
    });

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
    if (removeSwListener) {
      removeSwListener();
    }
    if (unsubscribeStore) {
      unsubscribeStore();
    }
  });
</script>

<main
  class="ag-main track-page"
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
    background-image: url('${backgroundUrl}');
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    background-repeat: no-repeat;
  `}
>
  <div class="track-header track-panel">
    <a class="track-back" href={`${appBase}/`}>← Menú principal</a>
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
    {#if isTracking}
      <MotionIndicator isTracking={isTracking} isMoving={isMoving} />
    {:else}
      <p style="max-width: 520px; margin: 0 auto; font-size: 0.95rem;">
        Para que el GPS y los audios se disparen correctamente, mantené la app abierta mientras
        caminás. Si el teléfono bloquea la pantalla, puede pausar el seguimiento.
      </p>
    {/if}
  </header>

  {#if selectedTour}
    {#if isOfflineReady}
      <section
        class="track-panel"
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
        class="track-panel"
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

  {#if dev}
    <section
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

  <section
    class="track-panel"
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
      {#if isTracking}
        Detener recorrido
      {:else}
        Iniciar recorrido
      {/if}
    </button>

    <p style="font-size: 0.9rem; max-width: 420px; margin: 0;">
      {statusMessage}
    </p>
    {#if isTracking}
      <p class="tracking-status" aria-live="polite">
        <span class="tracking-dot" aria-hidden="true"></span>
        Seguimiento activo
      </p>
    {/if}
  </section>

  <section
    class="track-panel"
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

    <div
      style="
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(0,0,0,0.1);
      "
    >
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Puntos del recorrido</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        {#each points as point}
          <li
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
</style>
