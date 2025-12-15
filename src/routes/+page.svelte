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

<main
  style="
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 2rem 1rem;
    text-align: center;
  "
>
  <h1 style="font-size: 1.8rem; margin-bottom: 0.25rem;">
    Guía Auditiva – Llao Llao
  </h1>

  <p style="max-width: 520px; font-size: 0.95rem; margin: 0 auto 1.5rem;">
    Elegí un recorrido para empezar a caminar con audio guiado.
  </p>

  <div
    style="
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      max-width: 360px;
    "
  >
    {#if tours.length === 0}
      <p style="font-size: 0.9rem; margin: 0;">
        Todavía no hay recorridos configurados.
      </p>
    {:else}
      {#each tours as tour}
        <div
          style="
            padding: 0.85rem 1.25rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(0,0,0,0.1);
            background: #f4f9ff;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <a
              href={`${base}/${tour.slug}`}
              style="
                text-decoration: none;
                font-weight: 700;
                font-size: 0.95rem;
                color: inherit;
              "
            >
              {tour.label}
            </a>
            <span style="font-size: 0.8rem; color: #555;">
              {formatMB(tour.offline?.totalBytes)}
            </span>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.85rem;">
              {#if downloadState[tour.id]?.status === "downloaded"}
                Offline listo
              {:else if downloadState[tour.id]?.status === "downloading"}
                Descargando…
              {:else}
                No descargado
              {/if}
            </span>

            {#if downloadState[tour.id]?.status === "downloaded"}
              <button
                type="button"
                on:click={() => deleteDownload(tour)}
                style="
                  border: none;
                  border-radius: 999px;
                  padding: 0.35rem 0.9rem;
                  font-size: 0.85rem;
                  cursor: pointer;
                  background: #f1c40f;
                  color: #1f1f1f;
                  font-weight: 600;
                "
              >
                Eliminar
              </button>
            {:else}
              <button
                type="button"
                on:click={() => requestDownload(tour)}
                style="
                  border: none;
                  border-radius: 999px;
                  padding: 0.35rem 0.9rem;
                  font-size: 0.85rem;
                  cursor: pointer;
                  background: #3498db;
                  color: white;
                  font-weight: 600;
                  opacity: {downloadState[tour.id]?.status === "downloading" ? 0.7 : 1};
                "
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
