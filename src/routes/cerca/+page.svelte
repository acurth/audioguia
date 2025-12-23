<script lang="ts">
  import { base } from "$app/paths";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
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

  type TourLink = {
    id: string;
    slug: string;
    label: string;
    points: Point[];
    ctaLabel: string;
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

  const tours: TourLink[] = Object.entries(tourModules).map(([path, data]) => {
    const filename = path.split("/").pop() ?? "";
    const idFromFile = filename.replace(".json", "");
    const id = typeof data.id === "string" ? data.id : idFromFile;
    const slug = typeof data.slug === "string" ? data.slug : id;
    const label = labelOverrides[id] ?? (typeof data.name === "string" ? data.name : id);
    const ctaLabel = ctaLabelOverrides[id] ?? "Abrir tour";
    const points = Array.isArray(data.points) ? data.points : [];
    return { id, slug, label, points, ctaLabel, offline: data.offline, raw: data };
  });

  type LocationStatus = "loading" | "ready" | "denied" | "error";
  let locationStatus: LocationStatus = "loading";
  let locationMessage = "";
  let userPosition: { lat: number; lng: number } | null = null;
  let downloadState: Record<
    string,
    { status?: string; bytes?: number; lastUpdate?: number; errorMessage?: string }
  > = {};
  let unsubscribeStore: (() => void) | null = null;

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
    next: { status?: string; bytes?: number; lastUpdate?: number; errorMessage?: string }
  ) {
    setDownloadState(id, next);
  }

  async function requestDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;
    setState(tour.id, {
      status: "downloading",
      bytes: tour.offline?.totalBytes,
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
    return Date.now() - lastUpdate > 30000;
  }

  $: sortedTours =
    userPosition === null
      ? []
      : tours
          .map((tour) => {
            const firstPoint = tour.points[0];
            if (!firstPoint || typeof firstPoint.lat !== "number" || typeof firstPoint.lng !== "number") {
              return { ...tour, distance: Number.POSITIVE_INFINITY };
            }
            const distance = getDistanceMeters(userPosition, {
              lat: firstPoint.lat,
              lng: firstPoint.lng
            });
            return { ...tour, distance };
          })
          .sort((a, b) => a.distance - b.distance);

  onMount(() => {
    if (browser) {
      initOfflineStore();
      unsubscribeStore = downloadStateStore.subscribe((state) => {
        downloadState = state;
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

    {#if locationStatus !== "ready"}
      <p class="empty-state">
        {locationStatus === "loading" ? "Buscando tu ubicación…" : locationMessage}
      </p>
    {:else}
      <div class="tour-list">
        {#each sortedTours as tour}
          <TourCard
            {base}
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
