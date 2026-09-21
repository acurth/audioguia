<script lang="ts">
	import { base } from '$app/paths';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { TourView } from '$lib/data/tourView';
	import type { DownloadState } from '$lib/stores/offline';
	import { getDisplayCounts, getProgressPercent } from '$lib/stores/downloads';
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

	const downloadLabel = $derived.by(() => {
		if (isDownloading) return `Descargando, ${percent} por ciento`;
		if (isDownloaded) return `Descargado. Tocá para eliminar los ${formatMB(tour.sizeBytes)}`;
		return `Descargar para usar sin conexión, ${formatMB(tour.sizeBytes)}`;
	});
</script>

<div class="td td--{variant}">
	<div class="td-photo">
		<img src={`${base}/${tour.imagePath}`} alt="" width="1200" height="800" />
	</div>

	<div class="td-body">
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

		{#if variant === 'page'}
			<p class="td-author">
				<img src={`${base}/branding/app-icon.png`} alt="" width="256" height="212" />
				<span>
					<span class="td-author-name">Audioguía Natural</span>
					<span class="td-author-role">Relato y grabación</span>
				</span>
			</p>
		{/if}

		<div class="td-actions">
			<a class="td-start" href={startHref}>
				<span class="td-start-icon" aria-hidden="true"><Icon name="play" size={16} /></span>
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
	.td-photo img {
		width: 100%;
		height: 206px;
		display: block;
		object-fit: cover;
		background: var(--ag-navy);
	}

	.td-body {
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

	.td-author {
		display: flex;
		align-items: center;
		gap: 11px;
		margin: 0 0 18px;
	}

	.td-author img {
		width: 42px;
		height: 42px;
		flex: none;
		border-radius: 10px;
		object-fit: contain;
		background: var(--ag-page);
	}

	.td-author-name,
	.td-author-role {
		display: block;
	}

	.td-author-name {
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.td-author-role {
		font-size: 12.5px;
		color: var(--ag-fg-3);
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
		width: 36px;
		height: 36px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(79, 181, 108, 0.22);
		border-radius: 50%;
		color: var(--ag-green-on-navy);
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

		.td--page .td-photo img {
			height: 100%;
			min-height: 100%;
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

	/* The tablet pane scrolls as one column under a taller photo. */
	.td--pane .td-photo img {
		height: 260px;
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
