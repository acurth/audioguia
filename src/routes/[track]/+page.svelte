<script lang="ts">
  import { onDestroy } from "svelte";
  import { page } from "$app/stores";
  import casaRoute from "$lib/data/tours/nvd-casa.json";
  import arrayanesRoute from "$lib/data/tours/nvd-0001.json";
  
  type Point = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    alt: number;
    radius: number;
    audio: string;
  };

  const routeMap: Record<string, { name: string; points: Point[] }> = {
    // Ruta de prueba en casa
    casa: {
      name: "Guía Auditiva – Test casa",
      points: (casaRoute as any).points as Point[]
    },
    "nvd-casa": {
      name: "Guía Auditiva – Test casa",
      points: (casaRoute as any).points as Point[]
    },

    // Sendero Arrayanes / Llao Llao (NVD)
    arrayanes: {
      name: "Guía Auditiva – Sendero Arrayanes / Llao Llao",
      points: (arrayanesRoute as any).points as Point[]
    },
    "nvd-0001": {
      name: "Guía Auditiva – Sendero Arrayanes / Llao Llao",
      points: (arrayanesRoute as any).points as Point[]
    }
  };

  let title: string = "Guía Auditiva – Test casa";
  let points: Point[] = (casaRoute as any).points as Point[];

  $: {
    const track = $page.params.track ?? "casa";
    const currentRoute = routeMap[track] ?? routeMap["casa"];
    title = currentRoute.name;
    points = currentRoute.points;
  }

  // Estado general
  let isTracking = false;
  let statusMessage = "Listo para iniciar el recorrido";

  // Posición actual
  let currentLat: number | null = null;
  let currentLng: number | null = null;
  let currentAccuracy: number | null = null;

  // Distancias dinámicas
  let distanceToFirstMeters: number | null = null;
  let pointDistances: Record<string, number> = {};

  // Geolocation watch id
  let watchId: number | null = null;

  // Puntos disparados
  let triggeredPointIds: string[] = [];
  let lastTriggeredPoint: Point | null = null;

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

    currentLat = latitude;
    currentLng = longitude;
    currentAccuracy = accuracy;

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

    if (!isTracking) return;

    for (const point of points) {
      if (triggeredPointIds.includes(point.id)) continue;

      const dist = distanceMeters(latitude, longitude, point.lat, point.lng);

      if (dist <= point.radius) {
        triggeredPointIds = [...triggeredPointIds, point.id];
        lastTriggeredPoint = point;
        void playPointAudio(point);
        break;
      }
    }
  }

  function handlePositionError(err: GeolocationPositionError) {
    console.error("Error de geolocalización", err);
    statusMessage = `Error de geolocalización (${err.code}): ${err.message}`;
  }

  function startTracking() {
    if (isTracking) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      statusMessage = "Tu navegador no soporta geolocalización";
      return;
    }

    initAudioPlayer();

    triggeredPointIds = [];
    lastTriggeredPoint = null;
    isTracking = true;
    statusMessage = "Iniciando seguimiento de ubicación…";

    watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });
  }

  function stopTracking() {
    isTracking = false;
    statusMessage = "Seguimiento detenido";

    if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (audioPlayer) {
      audioPlayer.pause();
    }
    currentAudioPointId = null;
    isAudioPlaying = false;
  }

  function toggleTracking() {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  onDestroy(() => {
    stopTracking();
  });
</script>

<main
  style="
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem 3rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    gap: 1.5rem;
  "
>
  <header>
    <h1 style="font-size: 1.8rem; margin-bottom: 0.25rem;">{title}</h1>
    <p style="max-width: 520px; margin: 0 auto; font-size: 0.95rem;">
      Caminá con el celular en el bolsillo. La app reproduce cada audio cuando entrás
      en el radio de los puntos del recorrido seleccionado.
    </p>
  </header>

  <section
    style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    "
  >
    <button
      on:click={toggleTracking}
      style="
        padding: 0.75rem 1.75rem;
        border-radius: 999px;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        background: {isTracking ? '#c0392b' : '#2ecc71'};
        color: white;
        font-weight: 600;
      "
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
  </section>

  <section
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
        {#if distanceToFirstMeters !== null}
          <p style="font-size: 0.9rem; margin: 0.1rem 0;">
            Distancia al punto 1 del recorrido: {formatDistance(distanceToFirstMeters)}
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
        max-height: 220px;
        overflow: auto;
      "
    >
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Puntos del recorrido</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">
        {#each points as point}
          <li
            style="
              font-size: 0.85rem;
              padding: 0.25rem 0;
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
                style="
                  border: none;
                  border-radius: 999px;
                  padding: 0.1rem 0.5rem;
                  font-size: 0.75rem;
                  cursor: pointer;
                  background: #ffffff;
                  box-shadow: 0 0 0 1px rgba(0,0,0,0.12);
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