<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import AgActionMark from '$lib/components/ui/AgActionMark.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { startTour } from '$lib/stores/tourSession';
	import type { TourView } from '$lib/data/tourView';
	import type { DownloadState } from '$lib/stores/offline';
	import { getDisplayCounts, getProgressPercent, isStalled } from '$lib/stores/downloads';
	import {
		difficultyLabel,
		formatApproxDistance,
		formatKm,
		formatMB,
		formatPointCount
	} from '$lib/utils/tourMeta';

	type Props = {
		tour: TourView;
		state?: DownloadState;
		/** Metres to the trailhead, when the position is known. */
		distanceMeters?: number | null;
		/** Marks test tours while dev mode is on. */
		showTestBadge?: boolean;
		now?: number;
		/**
		 * Marks this card as the one shown in the detail pane. Only the
		 * tablet layout uses it.
		 */
		selected?: boolean;
		/**
		 * Lets the tablet layout show the trail in its pane instead of
		 * navigating. It gets the event so it can decide: when it does not
		 * call preventDefault, the link behaves like a normal link.
		 */
		onSelect?: (tour: TourView, event: MouseEvent) => void;
		onDownload: (tour: TourView) => void;
		onDelete: (tour: TourView) => void;
		onRetry: (tour: TourView) => void;
	};

	let {
		tour,
		state,
		distanceMeters = null,
		showTestBadge = false,
		now = Date.now(),
		selected = false,
		onSelect,
		onDownload,
		onDelete,
		onRetry
	}: Props = $props();

	const detailHref = $derived(`${base}/${tour.slug}`);
	const startHref = $derived(`${base}/${tour.slug}/recorrido`);
	const imageSrc = $derived(`${base}/${tour.imagePath}`);
	const difficulty = $derived(difficultyLabel(tour.difficulty));
	const isDownloaded = $derived(state?.status === 'downloaded');
	const isDownloading = $derived(state?.status === 'downloading');
	const hasFailed = $derived(state?.status === 'error' || isStalled(state, now));
	const percent = $derived(getProgressPercent(state));
	const counts = $derived(getDisplayCounts(state));

	/**
	 * Play starts the walk, it does not open a screen that offers to start it.
	 * The tour is running by the time the screen appears, so there is no such
	 * thing as the Recorrido screen sitting idle: the screen for a trail that
	 * is not running is Detalle.
	 *
	 * startTour has to be called inside the click, not after the navigation,
	 * because unlocking the audio needs the gesture. It is not awaited: the
	 * screen opens at once and the GPS and the audio come up behind it.
	 */
	function handlePlay(event: MouseEvent) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		void startTour(tour, base);
		void goto(startHref);
	}

	// One sentence covering everything the pills and the meta row say, so the
	// download button announces the whole state instead of just "Descargar".
	const downloadLabel = $derived.by(() => {
		if (isDownloading) return `Descargando ${tour.name}, ${percent} por ciento`;
		if (isDownloaded) return `Eliminar la descarga de ${tour.name}`;
		if (hasFailed) return `Reintentar la descarga de ${tour.name}`;
		return `Descargar ${tour.name} para usar sin conexión, ${formatMB(tour.sizeBytes)}`;
	});

	function handleDownloadButton() {
		if (isDownloading) return;
		if (isDownloaded) onDelete(tour);
		else if (hasFailed) onRetry(tour);
		else onDownload(tour);
	}
</script>

<article class="tc" class:is-downloaded={isDownloaded} class:is-selected={selected}>
	<a
		class="tc-main"
		href={detailHref}
		aria-current={selected ? 'true' : undefined}
		onclick={(event) => onSelect?.(tour, event)}
	>
		<img class="tc-image" src={imageSrc} alt="" width="64" height="64" loading="lazy" />

		<div class="tc-body">
			<h2 class="tc-title">{tour.name}</h2>

			<p class="tc-pills">
				{#if difficulty}
					<span class="tc-pill">
						<Icon name="mountain" size={13} stroke={2.2} />
						{difficulty}
					</span>
				{/if}
				{#if showTestBadge}
					<span class="tc-pill tc-pill--test">Prueba</span>
				{/if}
			</p>

			<p class="tc-meta">
				<span>{formatKm(tour.lengthMeters)} aprox.</span>
				<span class="tc-dot" aria-hidden="true"></span>
				<span>{formatPointCount(tour.pointCount)}</span>
				<span class="tc-dot" aria-hidden="true"></span>
				<span>{formatMB(tour.sizeBytes)}</span>
				{#if distanceMeters != null && Number.isFinite(distanceMeters)}
					<span class="tc-dot" aria-hidden="true"></span>
					<span>{formatApproxDistance(distanceMeters)}</span>
				{/if}
			</p>

			{#if isDownloaded}
				<p class="tc-state tc-state--ready">
					<Icon name="check" size={12} stroke={2.6} />
					Offline listo
				</p>
			{:else if hasFailed}
				<p class="tc-state tc-state--error">
					<Icon name="alert" size={12} stroke={2.2} />
					{state?.errorMessage ?? 'Descarga detenida'}
				</p>
			{/if}
		</div>
	</a>

	<div class="tc-actions">
		<a
			class="tc-action tc-action--play"
			href={startHref}
			aria-label={`Iniciar el recorrido ${tour.name}`}
			onclick={handlePlay}
		>
			<AgActionMark action="trail-start" />
		</a>
		<button
			type="button"
			class="tc-action"
			class:is-ready={isDownloaded}
			class:is-error={hasFailed}
			aria-label={downloadLabel}
			aria-disabled={isDownloading}
			onclick={handleDownloadButton}
		>
			<span class="tc-action-mark" aria-hidden="true">
				{#if isDownloaded}
					<Icon name="trash" size={14} />
				{:else if hasFailed}
					<Icon name="plus" size={14} />
				{:else}
					<Icon name="download" size={14} />
				{/if}
			</span>
		</button>
	</div>

	{#if isDownloading}
		<div class="tc-progress">
			<div
				class="tc-progress-track"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent}
				aria-valuetext={`${percent} por ciento, archivo ${counts.current} de ${counts.total}`}
				aria-label={`Descarga de ${tour.name}`}
			>
				<span class="tc-progress-fill" style={`width: ${percent}%`}></span>
			</div>
			<p class="tc-progress-text">
				Descargando {counts.current} de {counts.total} · {percent}%
			</p>
		</div>
	{/if}
</article>

<style>
	.tc {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 12px;
		align-items: start;
		padding: 10px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-sm);
		box-shadow: 0 1px 2px rgba(16, 44, 68, 0.06);
		box-sizing: border-box;
	}

	.tc.is-downloaded {
		border-color: var(--ag-green-line);
	}

	/* The card shown in the tablet detail pane. Marked by a thicker border
	   and a tinted ground, not by colour alone. */
	.tc.is-selected {
		border: 2px solid var(--ag-green);
		padding: 9px;
		background: var(--ag-green-soft);
	}

	.tc-main {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		min-width: 0;
		text-decoration: none;
		color: inherit;
	}

	.tc-image {
		width: 64px;
		height: 64px;
		flex: none;
		border-radius: 6px;
		object-fit: cover;
		background: var(--ag-page);
	}

	.tc-body {
		flex: 1;
		min-width: 0;
	}

	.tc-title {
		margin: 0 0 7px;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.25;
		color: var(--ag-fg-1);
	}

	.tc-main:hover .tc-title {
		text-decoration: underline;
	}

	.tc-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 6px;
	}

	.tc-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 11px 4px 8px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-pill);
		color: var(--ag-green-ink);
		font-size: 11.5px;
		font-weight: 700;
		line-height: 1.1;
		white-space: nowrap;
	}

	.tc-pill--test {
		color: var(--ag-fg-2);
		padding: 4px 11px;
	}

	.tc-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		font-size: 12px;
		color: var(--ag-fg-3);
	}

	.tc-dot {
		width: 2.5px;
		height: 2.5px;
		flex: none;
		border-radius: 50%;
		background: var(--ag-muted);
	}

	.tc-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin: 7px 0 0;
		padding: 3px 9px;
		border-radius: var(--ag-r-pill);
		font-size: 11.5px;
		font-weight: 700;
	}

	.tc-state--ready {
		background: var(--ag-green-soft);
		border: 1px solid var(--ag-green-line);
		color: var(--ag-green-ink);
	}

	.tc-state--error {
		background: #fdecea;
		border: 1px solid #f3b7b1;
		color: var(--ag-danger);
	}

	.tc-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.tc-action {
		width: 60px;
		height: var(--ag-target);
		padding: 0;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-2);
		text-decoration: none;
		cursor: pointer;
	}

	.tc-action--play {
		color: var(--ag-green-ink);
	}

	.tc-action-mark {
		width: 60px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		background: var(--ag-page);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-pill);
	}

	.tc-action.is-ready .tc-action-mark {
		background: var(--ag-green-soft);
		border-color: var(--ag-green-line);
		color: var(--ag-green-ink);
	}

	.tc-action.is-error .tc-action-mark {
		background: #fdecea;
		border-color: #f3b7b1;
		color: var(--ag-danger);
	}

	.tc-action[aria-disabled='true'] {
		opacity: 0.55;
		cursor: default;
	}

	.tc-action:hover:not([aria-disabled='true']) .tc-action-mark {
		border-color: var(--ag-green);
	}

	.tc-progress {
		grid-column: 1 / -1;
	}

	.tc-progress-track {
		height: 6px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-border);
		overflow: hidden;
	}

	.tc-progress-fill {
		display: block;
		height: 100%;
		background: var(--ag-green-ink);
		transition: width var(--ag-motion) var(--ag-ease);
	}

	.tc-progress-text {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--ag-fg-2);
	}
</style>
