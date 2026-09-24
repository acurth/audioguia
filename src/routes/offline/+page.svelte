<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TopBar from '$lib/components/ui/TopBar.svelte';
	import TourCard from '$lib/components/ui/TourCard.svelte';
	import { getDevModeFromStorage } from '$lib/data/tours';
	import { getTourViews, type TourView } from '$lib/data/tourView';
	import { downloadStateStore } from '$lib/stores/offline';
	import type { DownloadState } from '$lib/stores/offline';
	import {
		deleteDownload,
		listenToDownloadProgress,
		requestDownload,
		resetDownload
	} from '$lib/stores/downloads';
	import { formatMB } from '$lib/utils/tourMeta';

	const LAST_TOUR_LIST_KEY = 'last-tour-list-path';

	const devMode = $derived(browser ? getDevModeFromStorage() : false);
	const tours = $derived(getTourViews(devMode));

	let downloadState = $state<Record<string, DownloadState>>({});
	let now = $state(Date.now());
	let confirmingRelease = $state(false);
	let query = $state('');

	const downloadedTours = $derived(
		tours.filter((tour) => downloadState[tour.id]?.status === 'downloaded')
	);
	/** The same search Explorar has, over what is already on the device. */
	const visibleDownloads = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return downloadedTours;
		return downloadedTours.filter((tour) =>
			[tour.name, tour.place, tour.raw.theme]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(needle)
		);
	});

	const totalBytes = $derived(
		downloadedTours.reduce((sum, tour) => sum + (tour.sizeBytes ?? 0), 0)
	);
	const summary = $derived(
		downloadedTours.length === 1
			? `1 recorrido descargado · ${formatMB(totalBytes)}`
			: `${downloadedTours.length} recorridos descargados · ${formatMB(totalBytes)}`
	);
	const liveMessage = $derived.by(() => {
		const announcements = Object.values(downloadState)
			.map((state) => state?.screenreaderText)
			.filter(Boolean);
		return announcements.length ? announcements[announcements.length - 1] : summary;
	});

	function getTourById(id: string): TourView | undefined {
		return tours.find((tour) => tour.id === id);
	}

	async function releaseAll() {
		for (const tour of downloadedTours) {
			await deleteDownload(tour);
		}
		confirmingRelease = false;
	}

	onMount(() => {
		sessionStorage.setItem(LAST_TOUR_LIST_KEY, `${base}/offline`);

		const stopStore = downloadStateStore.subscribe((state) => {
			downloadState = state;
		});
		const stopProgress = listenToDownloadProgress(getTourById);
		const tick = window.setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			stopStore();
			stopProgress();
			window.clearInterval(tick);
		};
	});
</script>

<TopBar title="Offline" />

<div class="page-offline">
	<div class="of-head">
		<!-- The heading lives in the top bar, beside the isologo, on every
		     screen size. -->
		{#if downloadedTours.length > 0}
			<div class="of-summary">
				<p class="of-summary-text">
					<Icon name="download" size={16} stroke={2.2} />
					{summary}
				</p>
				{#if confirmingRelease}
					<span class="of-confirm">
						<span class="of-confirm-text">¿Borrar todo?</span>
						<button type="button" class="of-link of-link--danger" onclick={releaseAll}>
							Sí, liberar
						</button>
						<button type="button" class="of-link" onclick={() => (confirmingRelease = false)}>
							Cancelar
						</button>
					</span>
				{:else}
					<button
						type="button"
						class="of-link"
						onclick={() => (confirmingRelease = true)}
						aria-label={`Liberar el espacio de ${summary}`}
					>
						Liberar
					</button>
				{/if}
			</div>

			<form
				class="of-search"
				role="search"
				onsubmit={(event) => {
					event.preventDefault();
				}}
			>
				<label class="sr-only" for="buscar-offline">Buscar entre los descargados</label>
				<span class="of-search-icon" aria-hidden="true"><Icon name="search" size={18} /></span>
				<input
					id="buscar-offline"
					type="search"
					bind:value={query}
					placeholder="Sendero, lugar o tema"
					autocomplete="off"
				/>
				{#if query}
					<button type="button" class="of-search-clear" onclick={() => (query = '')}>
						<Icon name="x" size={16} label="Borrar la búsqueda" />
					</button>
				{/if}
			</form>
		{/if}
	</div>

	<main id="main" class="of-body">
		<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{liveMessage}</div>

		{#if downloadedTours.length === 0}
			<p class="of-empty">
				Todavía no descargaste ningún recorrido. Descargalos antes de salir y funcionan sin señal.
			</p>
		{:else if visibleDownloads.length === 0}
			<p class="of-empty">
				Ninguno de tus recorridos descargados coincide con “{query}”.
			</p>
		{:else}
			<ul class="of-grid">
				{#each visibleDownloads as tour (tour.id)}
					<li>
						<TourCard
							{tour}
							{now}
							state={downloadState[tour.id]}
							showTestBadge={devMode && tour.status === 'test'}
							onDownload={requestDownload}
							onDelete={deleteDownload}
							onRetry={(t) => resetDownload(t, true)}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<section class="of-note" aria-labelledby="of-note-title">
			<h2 id="of-note-title">Los descargados funcionan sin señal</h2>
			<p>
				Quedan guardados los audios, las fotos y el mapa del recorrido. El GPS del teléfono sigue
				funcionando sin datos.
			</p>
			<a class="of-cta" href={`${base}/explorar`}>
				Descargar otro recorrido
				<Icon name="chevron-right" size={15} />
			</a>
		</section>
	</main>
</div>

<style>
	.page-offline {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* 8 px at the top, matching Explorar: the heading left this block for the
	   top bar, so everything below starts that much higher. */
	.of-head {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 8px var(--ag-side) 12px;
		background: var(--ag-surface);
		border-bottom: 1px solid var(--ag-border);
	}

	/* Same field as Explorar, so the two screens read as one pair. */
	.of-search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		min-height: var(--ag-target);
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-sm);
	}

	.of-search:focus-within {
		border-color: var(--ag-green);
	}

	.of-search-icon {
		display: flex;
		flex: none;
		color: var(--ag-fg-3);
	}

	/* 16 px is a hard floor: under it, iOS Safari zooms the page in when the
	   field is tapped and leaves it zoomed. */
	.of-search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 16px;
		color: var(--ag-fg-1);
	}

	.of-search-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex: none;
		padding: 0;
		background: none;
		border: none;
		color: var(--ag-fg-3);
		cursor: pointer;
	}

	.of-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 10px 12px;
		background: var(--ag-green-soft);
		border: 1px solid var(--ag-green-line);
		border-radius: var(--ag-r-sm);
	}

	.of-summary-text {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 0;
		min-width: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--ag-green-ink);
	}

	.of-confirm {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.of-confirm-text {
		font-size: 13px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.of-link {
		min-height: var(--ag-target);
		padding: 0 4px;
		background: none;
		border: none;
		color: var(--ag-green-ink);
		font-family: inherit;
		font-size: 13px;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
	}

	/* Deleting every download is the one destructive control on the screen,
	   so it asks first and is the only thing on the page in the danger red. */
	.of-link--danger {
		color: var(--ag-danger);
	}

	.of-body {
		flex: 1;
		padding: 16px var(--ag-side) 24px;
	}

	.of-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.of-empty {
		margin: 0;
		padding: 18px;
		background: var(--ag-surface);
		border: 1px dashed var(--ag-border);
		border-radius: var(--ag-r-md);
		font-size: 14px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	.of-note {
		margin-top: 16px;
		padding: 14px 15px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-md);
	}

	.of-note h2 {
		margin: 0 0 5px;
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.of-note p {
		margin: 0 0 10px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	.of-cta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--ag-target);
		color: var(--ag-green-ink);
		font-size: 13.5px;
		font-weight: 700;
		text-decoration: none;
	}

	.of-cta:hover {
		text-decoration: underline;
	}

	@media (min-width: 600px) and (orientation: landscape) {
		/* Same air as Explorar in landscape, for the same reason. */
		.of-head {
			padding: 14px var(--ag-side-land) 14px;
		}

		.of-body {
			padding: 16px var(--ag-side-land) 24px;
		}

		.of-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}

		.of-note {
			margin-top: 12px;
		}
	}

	@media (min-width: 600px) and (orientation: portrait) {
		.of-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
	}
</style>
