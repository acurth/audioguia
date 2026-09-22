<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TourDetail from '$lib/components/ui/TourDetail.svelte';
	import { getDevModeFromStorage } from '$lib/data/tours';
	import { getTourViews, type TourView } from '$lib/data/tourView';
	import { downloadStateStore } from '$lib/stores/offline';
	import type { DownloadState } from '$lib/stores/offline';
	import { deleteDownload, listenToDownloadProgress, requestDownload } from '$lib/stores/downloads';
	import { favouritesStore, initFavourites, toggleFavourite } from '$lib/stores/favourites';
	import { readListOrigin } from '$lib/stores/listOrigin';
	import { shareLink } from '$lib/utils/share';

	const devMode = $derived(browser ? getDevModeFromStorage() : false);
	const tours = $derived(getTourViews(devMode));
	const tour = $derived(
		tours.find((t) => t.slug === $page.params.track || t.id === $page.params.track)
	);

	let downloadState = $state<Record<string, DownloadState>>({});
	let favourites = $state<string[]>([]);
	let shareNotice = $state('');
	let backHref = $state(`${base}/explorar`);

	function getTourById(id: string): TourView | undefined {
		return tours.find((t) => t.id === id);
	}

	async function handleShare(target: TourView) {
		shareNotice = await shareLink({
			title: target.name,
			text: target.description ?? 'Un recorrido para escuchar.',
			url: `${window.location.origin}${base}/${target.slug}`
		});
	}

	onMount(() => {
		initFavourites();

		// Back goes to whichever list you came from, and to Explorar when you
		// arrived straight from a link. The same answer marks the tab.
		backHref = readListOrigin(base);

		const stopStore = downloadStateStore.subscribe((state) => {
			downloadState = state;
		});
		const stopFavourites = favouritesStore.subscribe((ids) => {
			favourites = ids;
		});
		const stopProgress = listenToDownloadProgress(getTourById);

		return () => {
			stopStore();
			stopFavourites();
			stopProgress();
		};
	});
</script>

<div class="page-detalle">
	<header class="de-bar">
		<a class="de-round" href={backHref} aria-label="Volver">
			<Icon name="chevron-left" size={18} />
		</a>
		<span class="de-kicker">Detalle del recorrido</span>
		<span class="de-round-spacer" aria-hidden="true"></span>
	</header>

	<main id="main">
		{#if tour}
			<TourDetail
				{tour}
				state={downloadState[tour.id]}
				isFavourite={favourites.includes(tour.id)}
				{shareNotice}
				onToggleFavourite={(t) => toggleFavourite(t.id)}
				onDownload={requestDownload}
				onDelete={deleteDownload}
				onShare={handleShare}
			/>
		{:else}
			<div class="de-missing">
				<h1>No encontramos ese recorrido</h1>
				<p>Puede que haya cambiado de nombre o que ya no esté publicado.</p>
				<a class="de-missing-cta" href={`${base}/explorar`}>
					Ver todos los recorridos
					<Icon name="chevron-right" size={16} />
				</a>
			</div>
		{/if}
	</main>
</div>

<style>
	.page-detalle {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--ag-surface);
	}

	.de-bar {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 52px;
		padding: 0 14px;
		background: var(--ag-surface);
		box-sizing: border-box;
	}

	.de-round,
	.de-round-spacer {
		width: var(--ag-target);
		height: var(--ag-target);
		flex: none;
	}

	.de-round {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-1);
		text-decoration: none;
	}

	.de-round:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	.de-kicker {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ag-fg-3);
	}

	main {
		flex: 1;
		min-height: 0;
	}

	.de-missing {
		padding: var(--ag-section) var(--ag-side);
	}

	.de-missing h1 {
		margin: 0 0 8px;
		font-size: 22px;
		font-weight: 800;
		color: var(--ag-fg-1);
	}

	.de-missing p {
		margin: 0 0 14px;
		font-size: 14px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	.de-missing-cta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--ag-target);
		color: var(--ag-green-ink);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}

	@media (min-width: 600px) and (orientation: landscape) {
		/* The photo column runs the full height of the screen, so the bar
		   floats over it instead of taking a row of its own. */
		.de-bar {
			position: absolute;
			top: 0;
			inset-inline-start: var(--ag-nav-inset-inline);
			z-index: 3;
			height: auto;
			width: 330px;
			padding: 14px;
			background: transparent;
		}

		.de-kicker,
		.de-round-spacer {
			display: none;
		}

		.de-round {
			background: rgba(16, 44, 68, 0.72);
			border-color: rgba(255, 255, 255, 0.35);
			color: #ffffff;
		}

		.de-round:hover {
			background: var(--ag-navy);
			color: #ffffff;
		}
	}
</style>
