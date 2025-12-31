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
    ctaLabel: string;
    status: TourStatus;
    sizeBytes?: number;
  };

  const labelOverrides: Record<string, string> = {
    "sendero-arrayanes-audio-01": "Sendero Arrayanes – Audioguía (Llao Llao)",
    "casa-test-01": "Casa – Tour de prueba"
  };

  const ctaLabelOverrides: Record<string, string> = {
    "sendero-arrayanes-audio-01": "Abrir Sendero Arrayanes Audio",
    "casa-test-01": "Abrir Test casa"
  };

  const devMode = $derived(browser ? getDevModeFromStorage() : false);
  const tours = $derived(
    getTourRecords(devMode).map(({ id, slug, status, data }) => {
      const name = labelOverrides[id] ?? (typeof data.name === "string" ? data.name : id);
      const ctaLabel = ctaLabelOverrides[id] ?? "Abrir tour";
      const sizeBytes = data.offline?.totalBytes;
      return { id, slug, name, ctaLabel, status, sizeBytes };
    })
  );

  let downloadState = $state<Record<string, DownloadState>>({});
  let unsubscribeStore: (() => void) | null = null;
  const noop = () => undefined;

  const appBase = base;

  async function deleteDownload(tour: TourLink) {
    if (!browser || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "delete-tour", id: tour.id });
    setDownloadState(tour.id, { status: "idle", bytes: undefined });
  }

  const offlineTours = $derived(tours.filter((tour) => downloadState[tour.id]?.status === "downloaded"));

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
            base={appBase}
            tour={tour}
            state={downloadState[tour.id]}
            onRequestDownload={noop}
            onDeleteDownload={deleteDownload}
            onResetDownload={noop}
            showTestBadge={devMode && tour.status === "test"}
          />
        {/each}
      </div>
    {/if}
  </main>
</div>
