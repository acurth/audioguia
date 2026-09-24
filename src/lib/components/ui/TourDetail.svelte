<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import AgActionMark from '$lib/components/ui/AgActionMark.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { TourView } from '$lib/data/tourView';
	import type { DownloadState } from '$lib/stores/offline';
	import { getDisplayCounts, getProgressPercent } from '$lib/stores/downloads';
	import { startTour } from '$lib/stores/tourSession';
	import { difficultyLabel, formatKm, formatMB, formatPointCount } from '$lib/utils/tourMeta';

	/**
	 * Everything about one trail: the photo, the numbers, the start button and
	 * the prose. The Detalle screen and the right pane of the tablet layout
	 * both render this, so the two cannot drift apart.
	 */
	type Props = {
		tour: TourView;
		state?: DownloadState;
		isFavourite: boolean;
		/** 'page' is the standalone screen, 'pane' the right half on tablet. */
		variant?: 'page' | 'pane';
		onToggleFavourite: (tour: TourView) => void;
		onDownload: (tour: TourView) => void;
		onDelete: (tour: TourView) => void;
		onShare: (tour: TourView) => void;
		/** Set after a share fell back to copying the link. */
		shareNotice?: string;
	};

	let {
		tour,
		state,
		isFavourite,
		variant = 'page',
		onToggleFavourite,
		onDownload,
		onDelete,
		onShare,
		shareNotice = ''
	}: Props = $props();

	const difficulty = $derived(difficultyLabel(tour.difficulty));
	const isDownloaded = $derived(state?.status === 'downloaded');
	const isDownloading = $derived(state?.status === 'downloading');
	const percent = $derived(getProgressPercent(state));
	const counts = $derived(getDisplayCounts(state));
	const startHref = $derived(`${base}/${tour.slug}/recorrido`);

	// Shown in the live region under the buttons, so it reaches a screen
	// reader as well as the screen.
	const downloadError = $derived(
		state?.status === 'error'
			? (state.errorMessage ?? 'No pudimos descargar este recorrido. Probá de nuevo.')
			: ''
	);

	const downloadLabel = $derived.by(() => {
		if (isDownloading) return `Descargando, ${percent} por ciento`;
		if (isDownloaded) return `Descargado. Tocá para eliminar los ${formatMB(tour.sizeBytes)}`;
		return `Descargar para usar sin conexión, ${formatMB(tour.sizeBytes)}`;
	});

	function handleStart(event: MouseEvent) {
		// Preserve normal link behaviour for modified clicks. A regular click
		// starts tracking while the user gesture is still active, then opens the
		// live recorrido screen, matching the play button on each trail card.
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		void startTour(tour, base);
		void goto(startHref);
	}
</script>

<div class="td td--{variant}">
	<div class="td-photo">
		<img src={`${base}/${tour.imagePath}`} alt="" width="900" height="1200" />
	</div>

	<div class="td-body">
		<!-- The name and the badges belong to the body, and where the photo is
		     wide they are lifted onto its lower edge, over a flat panel that
		     carries the contrast. The panel is a solid colour, not a gradient:
		     its worst case, over a white part of a photo, still gives 5.8:1
		     for white text. In landscape the photo is a narrow column whose
		     lower edge is off screen, so there they stay in the body. -->
		<div class="td-photo-head">
			<p class="td-pills">
				{#if difficulty}
					<span class="td-pill">
						<Icon name="mountain" size={13} stroke={2.2} />
						{difficulty}
					</span>
				{/if}
				{#if isDownloaded}
					<span class="td-pill td-pill--ready">
						<Icon name="check" size={12} stroke={2.6} />
						Offline listo
					</span>
				{/if}
			</p>

			<h1 class="td-title">{tour.name}</h1>

			<p class="td-meta">
				{#if tour.place}
					<span>{tour.place}</span>
					<span class="td-dot" aria-hidden="true"></span>
				{/if}
				<span>{formatKm(tour.lengthMeters)} aprox.</span>
				<span class="td-dot" aria-hidden="true"></span>
				<span>{formatPointCount(tour.pointCount)}</span>
				<span class="td-dot" aria-hidden="true"></span>
				<span>{formatMB(tour.sizeBytes)}</span>
			</p>
		</div>

		<div class="td-actions">
			<a class="td-start" href={startHref} onclick={handleStart}>
				<span class="td-start-icon"><AgActionMark action="trail-start" size="sm" skin="navy" /></span>
				<span class="td-start-text">Iniciar recorrido</span>
				<span class="td-start-count">{formatPointCount(tour.pointCount)}</span>
			</a>

			<div class="td-secondary">
				<button
					type="button"
					class="td-button"
					class:is-on={isFavourite}
					aria-pressed={isFavourite}
					onclick={() => onToggleFavourite(tour)}
				>
					<Icon name="heart" size={19} stroke={isFavourite ? 2.6 : 2} />
					<span>{isFavourite ? 'Guardado' : 'Favorito'}</span>
				</button>

				<button
					type="button"
					class="td-button"
					class:is-on={isDownloaded}
					aria-label={downloadLabel}
					aria-disabled={isDownloading}
					onclick={() => (isDownloaded ? onDelete(tour) : !isDownloading && onDownload(tour))}
				>
					{#if isDownloaded}
						<Icon name="check" size={19} stroke={2.6} />
						<span>Descargado</span>
					{:else if isDownloading}
						<Icon name="download" size={19} />
						<span>{percent}%</span>
					{:else}
						<Icon name="download" size={19} />
						<span>Descargar</span>
					{/if}
				</button>

				<button type="button" class="td-button" onclick={() => onShare(tour)}>
					<Icon name="share" size={19} />
					<span>Compartir</span>
				</button>
			</div>
		</div>

		{#if isDownloading}
			<div class="td-progress">
				<div
					class="td-progress-track"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					aria-valuetext={`${percent} por ciento, archivo ${counts.current} de ${counts.total}`}
					aria-label={`Descarga de ${tour.name}`}
				>
					<span class="td-progress-fill" style={`width: ${percent}%`}></span>
				</div>
				<p class="td-progress-text">Descargando {counts.current} de {counts.total}</p>
			</div>
		{/if}

		<div role="status" aria-live="polite" class="td-notice">
			{#if downloadError}
				<p class="td-notice--error">{downloadError}</p>
			{/if}
			{#if shareNotice}
				<p>{shareNotice}</p>
			{/if}
		</div>

		<section class="td-section" aria-labelledby="td-about-{tour.id}">
			<Eyebrow label="Sobre este recorrido" />
			<h2 id="td-about-{tour.id}" class="sr-only">Sobre este recorrido</h2>
			{#if tour.description}
				<p class="td-description">{tour.description}</p>
			{:else}
				<p class="td-description td-description--empty">
					Este recorrido todavía no tiene descripción.
				</p>
			{/if}
		</section>

		<section class="td-section" aria-labelledby="td-before-{tour.id}">
			<Eyebrow label="Antes de salir" />
			<h2 id="td-before-{tour.id}" class="sr-only">Antes de salir</h2>
			<div class="td-note">
				<span class="td-note-icon" aria-hidden="true">
					<Icon name="headphones" size={18} stroke={2.1} />
				</span>
				<p>
					Mantené la app abierta mientras caminás para que el GPS dispare los audios. Si el teléfono
					bloquea la pantalla, se pausa el seguimiento.
				</p>
			</div>
		</section>
	</div>
</div>

<style>
	.td-photo {
		position: relative;
	}

	/* The trail photos are portrait, 900 x 1200. A square mask keeps most of
	   that shape, so the walkers read as people on a trail rather than as a
	   row of heads. The crop sits below centre because in these photos the
	   group walks in the lower half. One value for every trail today; when
	   the photos vary enough to need it, it becomes a field in the tour JSON
	   and this becomes its default. */
	.td-photo img {
		width: 100%;
		/* height: auto, or the img's own height attribute wins and the ratio
		   below is ignored. */
		height: auto;
		aspect-ratio: 1 / 1;
		display: block;
		object-fit: cover;
		object-position: 50% 62%;
		background: var(--ag-navy);
	}

	/* bottom: 100% puts the panel immediately above the body, which is the
	   lower edge of the photo, without anyone having to know how tall the
	   photo is. */
	.td-photo-head {
		position: absolute;
		inset: auto 0 100% 0;
		padding: 13px var(--ag-side) 15px;
		/* 0.8, not 0.72: the panel now carries three lines instead of two, and
		   this is what holds the small grey-free meta line above 4.5:1 even
		   over the brightest part of a photo. */
		background: rgba(16, 44, 68, 0.8);
	}

	.td-photo-head .td-title {
		margin: 0 0 7px;
		color: #ffffff;
	}

	/* 14 px rather than the 13 px it had in the body, and white instead of
	   grey, because here it sits on a photo. */
	.td-photo-head .td-meta {
		margin: 0;
		font-size: 14px;
		color: #ffffff;
	}

	.td-photo-head .td-dot {
		background: rgba(255, 255, 255, 0.75);
	}

	.td-photo-head .td-pills {
		margin: 0 0 9px;
	}

	.td-photo-head .td-pills:empty {
		display: none;
	}

	.td-body {
		position: relative;
		padding: 16px var(--ag-side) 24px;
	}

	.td-pills {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 9px;
		margin: 0 0 12px;
	}

	.td-pill {
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

	.td-pill--ready {
		background: var(--ag-green-soft);
		border-color: var(--ag-green-line);
	}

	.td-title {
		margin: 0 0 12px;
		font-size: 25px;
		line-height: 1.18;
		font-weight: 800;
		letter-spacing: -0.015em;
		color: var(--ag-fg-1);
	}

	.td-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--ag-fg-3);
	}

	.td-dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--ag-muted);
	}

	.td-start {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 18px;
		background: var(--ag-navy);
		border-radius: var(--ag-r-md);
		box-shadow: 0 10px 24px rgba(16, 44, 68, 0.26);
		color: #ffffff;
		text-decoration: none;
		box-sizing: border-box;
	}

	.td-start:hover {
		background: var(--ag-navy-nav);
		color: #ffffff;
	}

	.td-start-icon {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.td-start-text {
		font-size: 16px;
		font-weight: 800;
		letter-spacing: 0.01em;
	}

	.td-start-count {
		font-size: 13px;
		font-weight: 600;
		color: var(--ag-on-dark-2);
	}

	.td-secondary {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}

	.td-button {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-height: 60px;
		padding: 11px 6px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-sm);
		color: var(--ag-fg-2);
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}

	/* Pressed state carries fill, border and label together, never colour
	   on its own: "Favorito" becomes "Guardado". */
	.td-button.is-on {
		background: var(--ag-green-soft);
		border-color: var(--ag-green-line);
		color: var(--ag-green-ink);
	}

	.td-button:hover:not([aria-disabled='true']) {
		border-color: var(--ag-green);
	}

	.td-button[aria-disabled='true'] {
		opacity: 0.6;
		cursor: default;
	}

	.td-progress {
		margin-top: 12px;
	}

	.td-progress-track {
		height: 6px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-border);
		overflow: hidden;
	}

	.td-progress-fill {
		display: block;
		height: 100%;
		background: var(--ag-green-ink);
		transition: width var(--ag-motion) var(--ag-ease);
	}

	.td-progress-text {
		margin: 6px 0 0;
		font-size: 12.5px;
		color: var(--ag-fg-2);
	}

	.td-notice:not(:empty) p {
		margin: 12px 0 0;
		padding: 10px 12px;
		background: var(--ag-green-soft);
		border: 1px solid var(--ag-green-line);
		border-radius: var(--ag-r-sm);
		font-size: 13px;
		color: var(--ag-green-ink);
	}

	/* An error is not carried by colour alone: it also says what went wrong
	   and what to do about it. */
	.td-notice p.td-notice--error {
		background: #fdeceb;
		border-color: var(--ag-danger);
		color: var(--ag-danger);
	}

	.td-section {
		margin-top: var(--ag-section);
	}

	.td-description {
		margin: var(--ag-eyebrow-gap) 0 0;
		font-size: 15px;
		line-height: 1.6;
		color: var(--ag-fg-1);
	}

	.td-description--empty {
		color: var(--ag-fg-3);
	}

	.td-note {
		display: flex;
		gap: 10px;
		margin-top: var(--ag-eyebrow-gap);
		padding: 13px 14px;
		background: var(--ag-page);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-sm);
		box-sizing: border-box;
	}

	.td-note-icon {
		display: flex;
		flex: none;
		color: var(--ag-green-ink);
	}

	.td-note p {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	/* Landscape: the photo becomes a column on the left and the text scrolls
	   on the right, because the height is what runs out. */
	@media (min-width: 600px) and (orientation: landscape) {
		.td--page {
			display: flex;
			align-items: stretch;
			min-height: 0;
			height: 100%;
		}

		.td--page .td-photo {
			width: 330px;
			flex: none;
		}

		/* Here the photo is a tall column, near the shape of the original, so
		   the crop stays centred and the aspect ratio gives way to the height
		   of the screen. */
		.td--page .td-photo img {
			height: 100%;
			min-height: 100%;
			aspect-ratio: auto;
			object-position: 50% 50%;
		}

		/* The photo runs past the bottom of the screen here, so the panel goes
		   back into the flow at the top of the text column. */
		.td--page .td-photo-head {
			position: static;
			padding: 0;
			background: none;
		}

		.td--page .td-photo-head .td-title {
			margin: 0 0 9px;
			color: var(--ag-fg-1);
		}

		.td--page .td-photo-head .td-meta {
			margin: 0 0 16px;
			font-size: 13px;
			color: var(--ag-fg-3);
		}

		.td--page .td-photo-head .td-dot {
			background: var(--ag-muted);
		}

		.td--page .td-body {
			flex: 1;
			min-width: 0;
			overflow-y: auto;
			padding: 20px var(--ag-side-land);
		}

		.td-title {
			font-size: 23px;
			margin-bottom: 9px;
		}

		.td-start {
			padding: 14px;
		}

		.td-secondary {
			margin-top: 10px;
		}

		.td-button {
			min-height: var(--ag-target);
			flex-direction: row;
			gap: 8px;
		}
	}

	/* The tablet pane scrolls as one column under the photo. The pane is wide,
	   so a square would be enormous: 5 by 4 keeps it tall without taking the
	   whole pane. */
	.td--pane .td-photo img {
		aspect-ratio: 5 / 4;
		object-position: 50% 70%;
	}

	.td--pane .td-photo-head {
		padding: 16px 20px 18px;
	}

	@media (min-width: 840px) {
		.td--pane .td-body {
			padding: 24px;
		}

		.td--pane .td-title {
			font-size: 30px;
		}

		.td--pane .td-secondary {
			margin-top: 12px;
		}
	}
</style>
