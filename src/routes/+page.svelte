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

  const tours: TourLink[] = Object.entries(tourModules)
    .map(([path, data]) => {
      const filename = path.split("/").pop() ?? "";
      const idFromFile = filename.replace(".json", "");

      const id = typeof data.id === "string" ? data.id : idFromFile;
      const slug = typeof data.slug === "string" ? data.slug : id;
      const label = typeof data.name === "string" ? data.name : id;
      const theme = typeof data.theme === "string" ? data.theme : undefined;
      const offline = data.offline;

      return { id, slug, label, theme, offline, raw: data };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  type DownloadState = {
    status: "idle" | "downloading" | "downloaded";
    bytes?: number;
  };

  const logoSrc = `${base}/branding/audioguia-natural-transparent.png`;

  let downloadState: Record<string, DownloadState> = {};

  function loadState() {
    if (!browser) return;
    const stored = localStorage.getItem("offline-downloads");
    if (stored) {
      try {
        downloadState = JSON.parse(stored);
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

  async function requestDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;

    setState(tour.id, { status: "downloading", bytes: tour.offline?.totalBytes });

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

  onMount(() => {
    loadState();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "tour-downloaded") {
          const tourId = data.id as string;
          const bytes = tours.find((t) => t.id === tourId)?.offline?.totalBytes;
          setState(tourId, { status: "downloaded", bytes });
        }
        if (data.type === "tour-deleted") {
          const tourId = data.id as string;
          const bytes = tours.find((t) => t.id === tourId)?.offline?.totalBytes;
          setState(tourId, { status: "idle", bytes });
        }
      });
    }
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
    <p class="hero-subtitle">Elegí un recorrido para empezar a caminar con audio guiado.</p>

    <div class="tour-list">
      {#if tours.length === 0}
        <p class="empty-state">Todavía no hay recorridos configurados.</p>
      {:else}
        {#each tours as tour}
          <div class="tour-card">
            <div class="tour-header">
              <a
                href={`${base}/${tour.slug}`}
                class="tour-link"
                aria-label={`Abrir tour ${tour.label}`}
              >
                {tour.label}
              </a>
              <span class="tour-size">{formatMB(tour.offline?.totalBytes)}</span>
            </div>

            <div class="tour-meta">
              <span class="status-text">
                {#if downloadState[tour.id]?.status === "downloaded"}
                  Offline listo
                {:else if downloadState[tour.id]?.status === "downloading"}
                  Descargando…
                {:else}
                  No descargado
                {/if}
              </span>

              {#if downloadState[tour.id]?.status === "downloaded"}
                <button type="button" on:click={() => deleteDownload(tour)} class="btn btn-delete">
                  Eliminar
                </button>
              {:else}
                <button
                  type="button"
                  on:click={() => requestDownload(tour)}
                  class="btn btn-download"
                  class:is-downloading={downloadState[tour.id]?.status === "downloading"}
                  disabled={downloadState[tour.id]?.status === "downloading"}
                >
                  {downloadState[tour.id]?.status === "downloading" ? "Descargando…" : "Descargar"}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </main>
</div>
