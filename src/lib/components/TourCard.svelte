<script lang="ts">
  import type { DownloadState } from "$lib/stores/offline";

  export let tour: TourSummary;
  export let base: string;
  export let state: DownloadState | undefined;
  export let metaText: string | undefined = undefined;
  export let onRequestDownload: TourAction;
  export let onDeleteDownload: TourAction;
  export let onResetDownload: TourResetAction;
  export let isStalled: (state: DownloadState | undefined) => boolean = () => false;

  type TourSummary = {
    id: string;
    name: string;
    distance?: number;
    sizeBytes?: number;
    slug?: string;
    ctaLabel?: string;
  };
  type TourAction = {
    bivarianceHack(tour: TourSummary): void | Promise<void>;
  }["bivarianceHack"];
  type TourResetAction = {
    bivarianceHack(tour: TourSummary, restart?: boolean): void | Promise<void>;
  }["bivarianceHack"];

  const defaultCtaLabel = "Abrir tour";

  function formatMB(bytes?: number) {
    if (!bytes) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getDownloadedBytes(state?: DownloadState, totalBytes?: number): number | undefined {
    if (!state || !totalBytes) return undefined;
    if (typeof state.downloadedBytes === "number") return state.downloadedBytes;
    if (state.completedFiles && state.totalFiles) {
      return Math.round((state.completedFiles / state.totalFiles) * totalBytes);
    }
    return undefined;
  }

  function getProgressPercent(state?: DownloadState): number {
    if (!state) return 0;
    if (typeof state.progress === "number") return state.progress;
    if (state.completedFiles && state.totalFiles) {
      return Math.round((state.completedFiles / state.totalFiles) * 100);
    }
    return 0;
  }

  function getFileLabel(state?: DownloadState): string | undefined {
    const url = state?.currentUrl;
    if (!url) return undefined;
    try {
      const last = url.split("/").pop();
      return last || undefined;
    } catch {
      return undefined;
    }
  }

  function getProgressCount(state?: DownloadState): string | null {
    if (!state || typeof state.totalFiles !== "number") return null;
    return `${state.completedFiles ?? 0}/${state.totalFiles}`;
  }

  function getStageLabel(stage?: DownloadState["stage"]): string {
    if (stage === "preparing") return "Preparando…";
    if (stage === "saving") return "Guardando para uso offline…";
    if (stage === "done") return "Listo";
    if (stage === "error") return "Error en la descarga";
    return "Descargando audios…";
  }
</script>

<article class="tour-card" class:offline-ready={state?.status === "downloaded"}>
  <div class="tour-card-inner">
    <div class="tour-top">
      <h2 class="sr-only">{tour.name}</h2>
      <div class="tour-actions">
        <a
          href={`${base}/${tour.slug ?? tour.id}`}
          class="btn btn-primary tour-cta"
          aria-label={tour.ctaLabel ?? defaultCtaLabel}
        >
          {tour.ctaLabel ?? defaultCtaLabel}
        </a>
      </div>
    </div>

    <div class="tour-bottom">
      {#if metaText}
        <p class="status-text">{metaText}</p>
      {/if}
      <p class="offline-status">
        {#if state?.status === "downloaded"}
          <span class="offline-ready-icon" aria-hidden="true">✓</span>
        {/if}
        Offline:
        {#if state?.status === "downloaded"}
          listo
        {:else if state?.status === "downloading"}
          descargando {getProgressCount(state) ?? `${getProgressPercent(state)}%`}
        {:else if state?.status === "error"}
          {state?.errorMessage ?? "error"}
        {:else}
          no descargado
        {/if}
        {#if tour.sizeBytes}
          · {#if state?.status === "downloading"}
            {formatMB(getDownloadedBytes(state, tour.sizeBytes))}
            de {formatMB(tour.sizeBytes)}
          {:else}
            {formatMB(tour.sizeBytes)}
          {/if}
        {/if}
        <span class="offline-action">
          {#if state?.status === "downloaded"}
            <button
              type="button"
              on:click={() => onDeleteDownload(tour)}
              class="btn-link offline-action-btn"
              aria-label={`Eliminar descarga del tour: ${tour.name}`}
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
          {:else if state?.status !== "downloading" && state?.status !== "error"}
            <button
              type="button"
              on:click={() => onRequestDownload(tour)}
              class="btn-link offline-action-btn"
              aria-label={`Descargar tour: ${tour.name}`}
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

      {#if state?.status === "downloading" || state?.status === "error"}
        <div class="offline-actions">
          {#if state?.status === "downloading"}
            <button
              type="button"
              on:click={() => onResetDownload(tour)}
              class="btn btn-reset"
              aria-label={`Restablecer descarga del tour ${tour.name}`}
            >
              Restablecer
            </button>
            {#if isStalled(state) || state?.errorMessage}
              <button
                type="button"
                on:click={() => onResetDownload(tour, true)}
                class="btn btn-retry"
                aria-label={`Reintentar descarga del tour ${tour.name}`}
              >
                Reintentar
              </button>
            {/if}
          {:else}
            <button
              type="button"
              on:click={() => onResetDownload(tour, true)}
              class="btn btn-retry"
              aria-label={`Reintentar descarga del tour ${tour.name}`}
            >
              Reintentar
            </button>
            <button
              type="button"
              on:click={() => onResetDownload(tour)}
              class="btn btn-reset"
              aria-label={`Restablecer descarga del tour ${tour.name}`}
            >
              Restablecer
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if state?.status === "downloading"}
      <div class="progress">
        <div class="progress-header">
          <span class="progress-label">Descargando…</span>
          <span class="progress-percent">{getProgressPercent(state)}%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={getProgressPercent(state)}
        >
          <div class="progress-fill" style={`width: ${getProgressPercent(state)}%`}></div>
        </div>
        <div class="progress-meta">
          <span>{getStageLabel(state?.stage)}</span>
          {#if state?.totalFiles}
            <span class="progress-stage">
              Descargando {state?.completedFiles ?? 0}/{state?.totalFiles}
            </span>
          {/if}
          {#if state?.currentIndex && state?.totalFiles}
            <span class="progress-stage">
              Archivo {state?.currentIndex}/{state?.totalFiles}
            </span>
          {/if}
          {#if getFileLabel(state)}
            <span class="progress-stage">{getFileLabel(state)}</span>
          {/if}
        </div>
        {#if state?.errorMessage}
          <p class="progress-error">{state?.errorMessage}</p>
        {/if}
        {#if state?.screenreaderText}
          <p class="sr-only" aria-live="polite">
            {state?.screenreaderText}
          </p>
        {/if}
      </div>
    {/if}
  </div>
</article>
