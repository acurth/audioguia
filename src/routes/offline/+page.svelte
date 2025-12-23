<script lang="ts">
  import { base } from "$app/paths";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { downloadStateStore, initOfflineStore, setDownloadState } from "$lib/stores/offline";
  import TourCard from "$lib/components/TourCard.svelte";

  type OfflineFile = { path: string; bytes: number };
  type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

  type TourJson = {
    id?: string;
    slug?: string;
    name?: string;
    offline?: OfflineManifest;
  };

  type TourLink = {
    id: string;
    slug: string;
    label: string;
    ctaLabel: string;
    offline?: OfflineManifest;
  };

  type DownloadState = {
    status?: "idle" | "downloading" | "downloaded" | "error";
    bytes?: number;
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
    const offline = data.offline;
    return { id, slug, label, ctaLabel, offline };
  });

  let downloadState: Record<string, DownloadState> = {};
  let unsubscribeStore: (() => void) | null = null;
  const noop = () => undefined;

  async function deleteDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "delete-tour", id: tour.id });
    setDownloadState(tour.id, { status: "idle", bytes: undefined });
  }

  $: offlineTours = tours.filter((tour) => downloadState[tour.id]?.status === "downloaded");

  onMount(() => {
    if (!browser) return;
    initOfflineStore();
    unsubscribeStore = downloadStateStore.subscribe((state) => {
      downloadState = state;
    });

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
    <h1 class="hero-title">Recorridos offline</h1>
    <p class="hero-subtitle">Recorridos descargados para usar sin conexión.</p>

    {#if offlineTours.length === 0}
      <p class="empty-state">
        No hay recorridos descargados. Podés bajar un tour desde Explorar para usarlo sin conexión.
      </p>
    {:else}
      <div class="tour-list">
        {#each offlineTours as tour}
          <TourCard
            {base}
            tour={tour}
            state={downloadState[tour.id]}
            onRequestDownload={noop}
            onDeleteDownload={deleteDownload}
            onResetDownload={noop}
          />
        {/each}
      </div>
    {/if}
  </main>
</div>
