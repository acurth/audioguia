<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TopBar from '$lib/components/ui/TopBar.svelte';
	import TourCard from '$lib/components/ui/TourCard.svelte';
	import FilterBar, { type SortKey } from '$lib/components/ui/FilterBar.svelte';
	import TourDetail from '$lib/components/ui/TourDetail.svelte';
	import { getDevModeFromStorage } from '$lib/data/tours';
	import { getTourViews, type TourView } from '$lib/data/tourView';
	import { downloadStateStore } from '$lib/stores/offline';
	import type { DownloadState } from '$lib/stores/offline';
	import {
		deleteDownload,
		listenToDownloadProgress,
		requestDownload,
		resetDownload,
		verifyDownloads
	} from '$lib/stores/downloads';
	import { positionStore, requestPosition } from '$lib/stores/position';
	import { favouritesStore, initFavourites, toggleFavourite } from '$lib/stores/favourites';
	import { distanceMeters } from '$lib/utils/tourMeta';
	import { shareLink } from '$lib/utils/share';

	const LAST_TOUR_LIST_KEY = 'last-tour-list-path';

	const devMode = $derived(browser ? getDevModeFromStorage() : false);
	const tours = $derived(getTourViews(devMode));
	const showAccessibleFilter = $derived(tours.some((tour) => tour.accessible));

	let downloadState = $state<Record<string, DownloadState>>({});
	let position = $state($positionStore);
	let query = $state('');
	// Cerca mío is the order the redesign opens with, and asking for the
	// position on load would be a permission prompt nobody requested. So the
	// list starts by name and switches to distance when the chip is pressed.
	let sort = $state<SortKey>('nombre');
	let onlyDownloaded = $state(false);
	let onlyAccessible = $state(false);
	let now = $state(Date.now());
	let favourites = $state<string[]>([]);
	let shareNotice = $state('');
	let selectedId = $state<string | null>(null);
	// True only on the master-detail layout. The same click navigates on a
	// phone and fills the pane on a tablet.
	let isTabletLayout = $state(false);

	/** Metres from the current position to each trailhead, when known. */
	const distances = $derived.by(() => {
		const coords = position.coords;
		if (!coords) return {} as Record<string, number>;
		const out: Record<string, number> = {};
		for (const tour of tours) {
			const head = tour.points[0];
			if (head && typeof head.lat === 'number' && typeof head.lng === 'number') {
				out[tour.id] = distanceMeters(coords, { lat: head.lat, lng: head.lng });
			}
		}
		return out;
	});

	const visibleTours = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const filtered = tours.filter((tour) => {
			if (onlyDownloaded && downloadState[tour.id]?.status !== 'downloaded') return false;
			if (onlyAccessible && !tour.accessible) return false;
			if (!needle) return true;
			const haystack = [tour.name, tour.place, tour.raw.theme]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return haystack.includes(needle);
		});

		const sorted = [...filtered];
		if (sort === 'cortos') {
			sorted.sort((a, b) => a.lengthMeters - b.lengthMeters);
		} else if (sort === 'cerca' && position.coords) {
			sorted.sort(
				(a, b) =>
					(distances[a.id] ?? Number.POSITIVE_INFINITY) -
					(distances[b.id] ?? Number.POSITIVE_INFINITY)
			);
		} else {
			sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
		}
		return sorted;
	});

	// The participle agrees with the count: "1 recorrido · ordenado por
	// nombre", "3 recorridos · ordenados por nombre".
	/** The trail in the detail pane: the chosen one, or the first listed. */
	const selectedTour = $derived(
		visibleTours.find((tour) => tour.id === selectedId) ?? visibleTours[0]
	);

	const sortLabel = $derived.by(() => {
		const ordenado = visibleTours.length === 1 ? 'ordenado' : 'ordenados';
		if (sort === 'cortos') return `${ordenado} por largo`;
		if (sort === 'cerca' && position.coords) return `${ordenado} por distancia`;
		if (sort === 'cerca') return `${ordenado} por nombre mientras buscamos tu ubicación`;
		return `${ordenado} por nombre`;
	});

	const countLabel = $derived(
		`${visibleTours.length} ${visibleTours.length === 1 ? 'recorrido' : 'recorridos'} · ${sortLabel}`
	);

	/** What the live region says: the result count, plus any download news. */
	const liveMessage = $derived.by(() => {
		const announcements = Object.values(downloadState)
			.map((state) => state?.screenreaderText)
			.filter(Boolean);
		if (announcements.length) return announcements[announcements.length - 1];
		if (isTabletLayout && selectedTour) return `${countLabel}. Mostrando ${selectedTour.name}.`;
		return countLabel;
	});

	function getTourById(id: string): TourView | undefined {
		return tours.find((tour) => tour.id === id);
	}

	function handleSelect(tour: TourView, event: MouseEvent) {
		// Let the browser do its job for new tabs and middle clicks.
		if (!isTabletLayout || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
			return;
		}
		event.preventDefault();
		selectedId = tour.id;
		shareNotice = '';
	}

	async function handleShare(tour: TourView) {
		shareNotice = await shareLink({
			title: tour.name,
			text: tour.description ?? 'Un recorrido para escuchar.',
			url: `${window.location.origin}${base}/${tour.slug}`
		});
	}

	function handleSort(next: SortKey) {
		sort = next;
		if (next === 'cerca' && !position.coords) requestPosition();
	}

	onMount(() => {
		sessionStorage.setItem(LAST_TOUR_LIST_KEY, `${base}/explorar`);

		const stopStore = downloadStateStore.subscribe((state) => {
			downloadState = state;
		});
		const stopPosition = positionStore.subscribe((state) => {
			position = state;
		});
		const stopProgress = listenToDownloadProgress(getTourById);
		const stopFavourites = favouritesStore.subscribe((ids) => {
			favourites = ids;
		});
		const tick = window.setInterval(() => {
			now = Date.now();
		}, 1000);

		initFavourites();

		const tabletQuery = window.matchMedia(
			'(min-width: 840px) and (min-height: 600px) and (orientation: landscape)'
		);
		const syncLayout = () => {
			isTabletLayout = tabletQuery.matches;
		};
		syncLayout();
		tabletQuery.addEventListener('change', syncLayout);

		void verifyDownloads(tours);

		// Deep link from the search field on Inicio: /explorar?q=cascada
		const initialQuery = $page.url.searchParams.get('q');
		if (initialQuery) query = initialQuery;
		if ($page.url.searchParams.get('orden') === 'cerca') handleSort('cerca');

		return () => {
			stopStore();
			stopPosition();
			stopProgress();
			stopFavourites();
			tabletQuery.removeEventListener('change', syncLayout);
			window.clearInterval(tick);
		};
	});
</script>

<TopBar />

<div class="page-explorar">
	<div class="ex-master">
		<div class="ex-controls">
			<div class="ex-heading">
				<h1>Explorar</h1>
				<p class="ex-count">{countLabel}</p>
			</div>

			<form
				class="ex-search"
				role="search"
				onsubmit={(event) => {
					event.preventDefault();
				}}
			>
				<label class="sr-only" for="buscar">Buscar recorridos</label>
				<span class="ex-search-icon" aria-hidden="true"><Icon name="search" size={18} /></span>
				<input
					id="buscar"
					type="search"
					bind:value={query}
					placeholder="Sendero, lugar o tema"
					autocomplete="off"
				/>
				{#if query}
					<button type="button" class="ex-search-clear" onclick={() => (query = '')}>
						<Icon name="x" size={16} label="Borrar la búsqueda" />
					</button>
				{/if}
			</form>

			<FilterBar
				{sort}
				{onlyDownloaded}
				{onlyAccessible}
				showAccessible={showAccessibleFilter}
				locating={position.status === 'locating'}
				onSort={handleSort}
				onToggleDownloaded={() => (onlyDownloaded = !onlyDownloaded)}
				onToggleAccessible={() => (onlyAccessible = !onlyAccessible)}
			/>

			{#if sort === 'cerca' && position.message}
				<p class="ex-notice">{position.message}</p>
			{/if}
		</div>

		<main id="main" class="ex-list">
			<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">{liveMessage}</div>

			{#if visibleTours.length === 0}
				<p class="ex-empty">
					{#if query}
						No encontramos recorridos para “{query}”. Probá con otra palabra.
					{:else if onlyDownloaded}
						Todavía no descargaste ningún recorrido.
					{:else}
						Todavía no hay recorridos configurados.
					{/if}
				</p>
			{:else}
				<ul class="ex-grid">
					{#each visibleTours as tour (tour.id)}
						<li>
							<TourCard
								{tour}
								{now}
								state={downloadState[tour.id]}
								distanceMeters={distances[tour.id] ?? null}
								showTestBadge={devMode && tour.status === 'test'}
								selected={isTabletLayout && tour.id === selectedTour?.id}
								onSelect={handleSelect}
								onDownload={requestDownload}
								onDelete={deleteDownload}
								onRetry={(t) => resetDownload(t, true)}
							/>
						</li>
					{/each}
				</ul>
			{/if}

			<p class="ex-hint">
				Recomendación: descargá el recorrido antes de salir del Wi-Fi o de una buena conexión de
				datos.
			</p>
		</main>
	</div>

	<!-- Tablet and desktop: the chosen trail opens beside the list instead of
	     on a screen of its own. CSS hides this pane below 840 px, where the
	     cards navigate to the Detalle screen as usual. -->
	{#if selectedTour}
		<aside class="ex-detail" aria-label={`Detalle de ${selectedTour.name}`}>
			<TourDetail
				tour={selectedTour}
				variant="pane"
				state={downloadState[selectedTour.id]}
				isFavourite={favourites.includes(selectedTour.id)}
				{shareNotice}
				onToggleFavourite={(t) => toggleFavourite(t.id)}
				onDownload={requestDownload}
				onDelete={deleteDownload}
				onShare={handleShare}
			/>
		</aside>
	{/if}
</div>

<style>
	.page-explorar {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.ex-master {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Hidden until there is room for two columns. */
	.ex-detail {
		display: none;
	}

	.ex-controls {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px var(--ag-side);
		background: var(--ag-surface);
		border-bottom: 1px solid var(--ag-border);
	}

	/* Stacked on a phone: the title and the count do not fit on one line at
	   430 px, and squeezing them clips the count. */
	.ex-heading {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ex-heading h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: var(--ag-fg-1);
	}

	.ex-count {
		margin: 0;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ag-fg-3);
	}

	.ex-search {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		min-height: var(--ag-target);
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-sm);
	}

	.ex-search:focus-within {
		border-color: var(--ag-green);
	}

	.ex-search-icon {
		display: flex;
		flex: none;
		color: var(--ag-green-ink);
	}

	/* 16 px is a hard floor: under it, iOS Safari zooms the page in when the
	   field is tapped and leaves it zoomed. */
	.ex-search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 16px;
		color: var(--ag-fg-1);
	}

	.ex-search-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex: none;
		background: none;
		border: none;
		border-radius: 50%;
		color: var(--ag-fg-2);
		cursor: pointer;
	}

	.ex-notice {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--ag-fg-2);
	}

	.ex-list {
		flex: 1;
		padding: 16px var(--ag-side) 24px;
	}

	.ex-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ex-empty {
		margin: 0 0 16px;
		padding: 18px;
		background: var(--ag-surface);
		border: 1px dashed var(--ag-border);
		border-radius: var(--ag-r-md);
		font-size: 14px;
		color: var(--ag-fg-2);
	}

	.ex-hint {
		margin: 16px 0 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--ag-fg-3);
	}

	/* Landscape and tablet: no top bar, so the controls carry the page, and
	   the cards go two across. */
	@media (min-width: 600px) and (orientation: landscape) {
		.ex-controls {
			padding: 14px var(--ag-side-land) 12px;
		}

		.ex-heading {
			flex-direction: row;
			align-items: baseline;
			justify-content: space-between;
			gap: 12px;
			flex-wrap: wrap;
		}

		.ex-list {
			padding: 14px var(--ag-side-land) 20px;
		}

		.ex-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
	}

	/* Master-detail from 840 px: the list keeps its own scroll on the left,
	   the trail opens on the right, and both are visible at once. */
	@media (min-width: 840px) and (min-height: 600px) and (orientation: landscape) {
		.page-explorar {
			flex-direction: row;
			align-items: stretch;
		}

		.ex-master {
			width: 420px;
			flex: none;
			overflow-y: auto;
			background: var(--ag-page);
			border-right: 1px solid var(--ag-border);
		}

		.ex-controls {
			background: var(--ag-page);
			border-bottom: none;
			padding: 24px 24px 12px;
		}

		.ex-heading h1 {
			font-size: 26px;
		}

		.ex-list {
			padding: 0 24px 24px;
		}

		.ex-grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.ex-detail {
			display: block;
			flex: 1;
			min-width: 0;
			overflow-y: auto;
			background: var(--ag-surface);
		}
	}

	/* Tablet in portrait keeps the phone structure, with the list in two
	   columns because the width allows it. */
	@media (min-width: 600px) and (orientation: portrait) {
		.ex-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
	}
</style>
