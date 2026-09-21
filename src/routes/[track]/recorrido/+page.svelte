<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppNav from '$lib/components/ui/AppNav.svelte';
	import AudioPlayer from '$lib/components/ui/AudioPlayer.svelte';
	import CurrentPointCard from '$lib/components/ui/CurrentPointCard.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import MovementIndicator from '$lib/components/MovementIndicator.svelte';
	import PhotoViewer from '$lib/components/ui/PhotoViewer.svelte';
	import PointPhoto from '$lib/components/ui/PointPhoto.svelte';
	import TrailMap from '$lib/components/ui/TrailMap.svelte';
	import TrailProgress from '$lib/components/ui/TrailProgress.svelte';
	import { getDevModeFromStorage } from '$lib/data/tours';
	import { getTourViews } from '$lib/data/tourView';
	import { downloadStateStore, initOfflineStore } from '$lib/stores/offline';
	import type { DownloadState } from '$lib/stores/offline';
	import {
		closePhoto,
		cumulativeMeters,
		cyclePlaybackRate,
		playPoint,
		seekTo,
		setPhotoFullscreen,
		skipSeconds,
		startTour,
		stopTour,
		togglePhoto,
		togglePlay,
		tourSession,
		wakeLockLine
	} from '$lib/stores/tourSession';

	const devMode = $derived(browser ? getDevModeFromStorage() : false);
	const tours = $derived(getTourViews(devMode));
	const tour = $derived(
		tours.find((t) => t.slug === $page.params.track || t.id === $page.params.track)
	);

	let session = $state($tourSession);
	let downloadState = $state<Record<string, DownloadState>>({});
	// Measured, because the postcard size rule is in pixels.
	let mapWidth = $state(0);
	let mapHeight = $state(0);
	// On tablet the photo has its own place on screen, so it is never an
	// overlay and the card button enlarges instead of opening.
	let photoBeside = $state(false);

	const detailHref = $derived(`${base}/${$page.params.track}`);
	const isOfflineReady = $derived(
		Boolean(tour?.id && downloadState[tour.id]?.status === 'downloaded')
	);
	const isThisTour = $derived(session.status === 'tracking' && session.slug === tour?.slug);
	const points = $derived(tour?.points ?? []);
	const cumulative = $derived(cumulativeMeters(points));
	const totalMeters = $derived(cumulative.at(-1) ?? 0);

	const currentPoint = $derived(
		points.find((p) => p.id === session.currentPointId) ??
			points.find((p) => !session.triggeredIds.includes(p.id)) ??
			points[0]
	);
	const currentNumber = $derived(
		currentPoint ? points.findIndex((p) => p.id === currentPoint.id) + 1 : 0
	);
	const currentDistance = $derived(
		currentPoint ? (session.distances[currentPoint.id] ?? null) : null
	);
	const pointLabel = $derived(
		currentPoint ? `Relato del punto ${currentPoint.id}` : 'Relato del punto'
	);

	const photoSrc = $derived(currentPoint?.photos?.[0] ? `${base}/${currentPoint.photos[0]}` : null);
	// No written description yet means the photo is decorative: a screen
	// reader gets the point name from the card and the rest from the audio.
	const photoAlt = $derived(currentPoint?.photoAlt ?? '');
	/**
	 * The button only exists while the walker is at the point. Once they are
	 * past it, a control that opens the photo of a point left behind is
	 * noise, so it goes.
	 */
	const atCurrentPoint = $derived(
		isThisTour && !!photoSrc && currentDistance != null && currentDistance <= 40
	);
	const showOverlayPhoto = $derived(isThisTour && !!photoSrc && session.photoOpen && !photoBeside);
	const showBesidePhoto = $derived(isThisTour && !!photoSrc && photoBeside);

	// Everything a screen reader needs, in one line, refreshed as it changes.
	const spokenStatus = $derived.by(() => {
		if (!isThisTour) return session.statusMessage;
		const bits = [session.statusMessage];
		if (currentPoint) {
			bits.push(`Punto ${currentNumber} de ${points.length}: ${currentPoint.name}.`);
		}
		if (currentDistance != null) bits.push(`A ${Math.round(currentDistance)} metros.`);
		if (session.gpsWarning) bits.push(`${session.gpsWarning}.`);
		const wake = wakeLockLine(session);
		if (wake) bits.push(wake);
		return bits.join(' ');
	});

	async function handleStart() {
		if (!tour) return;
		await startTour(tour, base);
	}

	function handleStop() {
		stopTour();
		void goto(detailHref);
	}

	function handlePlayCurrent() {
		if (!currentPoint) return;
		// Nothing loaded yet: the first tap starts this point rather than
		// resuming silence.
		if (!session.currentPointId) void playPoint(currentPoint, base);
		else togglePlay();
	}

	onMount(() => {
		initOfflineStore();

		const tabletQuery = window.matchMedia(
			'(min-width: 840px) and (min-height: 600px) and (orientation: landscape)'
		);
		const syncLayout = () => {
			photoBeside = tabletQuery.matches;
		};
		syncLayout();
		tabletQuery.addEventListener('change', syncLayout);
		const stopSession = tourSession.subscribe((value) => {
			session = value;
		});
		const stopDownloads = downloadStateStore.subscribe((value) => {
			downloadState = value;
		});
		return () => {
			stopSession();
			stopDownloads();
			tabletQuery.removeEventListener('change', syncLayout);
		};
	});
</script>

<div class="rec">
	<header class="rec-bar">
		<a class="rec-round" href={detailHref} aria-label="Volver al detalle del recorrido">
			<Icon name="chevron-down" size={20} stroke={2.2} />
		</a>

		<!-- In portrait the state sits between the two round controls and the
		     title goes on its own line underneath. In landscape both stack in
		     the middle of the same row, which saves a row of height. -->
		<div class="rec-headline">
			{#if isThisTour}
				<span class="rec-state">
					<span class="rec-state-dot" aria-hidden="true"></span>
					En recorrido
				</span>
			{:else}
				<span class="rec-state rec-state--idle">Sin iniciar</span>
			{/if}

			<h1 class="rec-title">{tour?.name ?? 'Recorrido'}</h1>
		</div>

		<span class="rec-round-spacer" aria-hidden="true">
			<MovementIndicator isTracking={isThisTour} isMoving={session.isMoving} />
		</span>
	</header>

	<main id="main" class="rec-body">
		<p class="sr-only" role="status" aria-live="polite">{spokenStatus}</p>

		{#if !tour}
			<p class="rec-empty">No encontramos ese recorrido.</p>
		{:else}
			<div class="rec-map">
				<div class="rec-map-box" bind:clientWidth={mapWidth} bind:clientHeight={mapHeight}>
					<TrailMap
						{points}
						triggeredIds={session.triggeredIds}
						currentPointId={isThisTour ? session.currentPointId : null}
						position={isThisTour ? session.position : null}
						tourName={tour.name}
					/>

					{#if showOverlayPhoto && photoSrc && mapWidth > 0}
						<PointPhoto
							src={photoSrc}
							alt={photoAlt}
							boxWidth={mapWidth}
							boxHeight={mapHeight}
							onClose={closePhoto}
							onExpand={() => setPhotoFullscreen(true)}
						/>
					{/if}
				</div>

				{#if showBesidePhoto && photoSrc}
					<figure class="rec-photo-beside">
						<button type="button" onclick={() => setPhotoFullscreen(true)}>
							<img src={photoSrc} alt={photoAlt} />
							<span class="sr-only">Ampliar la foto del punto</span>
						</button>
					</figure>
				{/if}
			</div>

			<div class="rec-panel">
				<TrailProgress
					{points}
					{cumulative}
					{totalMeters}
					walkedMeters={session.walkedMeters}
					heardCount={session.triggeredIds.length}
					elapsedMs={session.elapsedMs}
				/>

				{#if isThisTour}
					{#if currentPoint}
						<CurrentPointCard
							point={currentPoint}
							number={currentNumber}
							total={points.length}
							distance={currentDistance}
							photoOpen={session.photoOpen}
							showPhotoButton={atCurrentPoint}
							photoAlwaysVisible={photoBeside}
							onTogglePhoto={() => (photoBeside ? setPhotoFullscreen(true) : togglePhoto())}
						/>
					{/if}

					<AudioPlayer
						{pointLabel}
						isPlaying={session.isPlaying}
						currentTime={session.currentTime}
						duration={session.duration}
						playbackRate={session.playbackRate}
						onTogglePlay={handlePlayCurrent}
						onSeek={seekTo}
						onSkip={skipSeconds}
						onCycleRate={cyclePlaybackRate}
					/>

					{#if session.gpsWarning}
						<p class="rec-warning">
							<Icon name="alert" size={15} stroke={2.2} />
							{session.gpsWarning}. Los audios pueden tardar en dispararse.
						</p>
					{/if}

					<button type="button" class="rec-stop" onclick={handleStop}>
						<Icon name="stop" size={16} />
						Detener recorrido
					</button>
				{:else}
					<div class="rec-start-block">
						<p class="rec-start-text">
							Al iniciar, los relatos se activan solos cuando llegás a cada punto. Mantené la app
							abierta mientras caminás.
						</p>
						{#if !isOfflineReady}
							<p class="rec-start-warning">
								<Icon name="alert" size={15} stroke={2.2} />
								Este recorrido no está descargado. Sin señal no vas a poder escucharlo.
							</p>
						{/if}
						<button type="button" class="rec-start" onclick={handleStart}>
							<span class="rec-start-icon" aria-hidden="true"><Icon name="play" size={16} /></span>
							Iniciar recorrido
						</button>
					</div>
				{/if}

				{#if devMode}
					<dl class="rec-dev">
						<div>
							<dt>Precisión</dt>
							<dd>{session.position ? `${Math.round(session.position.accuracy)} m` : '—'}</dd>
						</div>
						<div>
							<dt>Radio efectivo</dt>
							<dd>{session.effectiveRadius ? `${Math.round(session.effectiveRadius)} m` : '—'}</dd>
						</div>
						<div>
							<dt>Disparados</dt>
							<dd>{session.triggeredIds.length} de {points.length}</dd>
						</div>
						<div>
							<dt>Avance</dt>
							<dd>{Math.round(session.walkedMeters)} m</dd>
						</div>
						<div>
							<dt>Pantalla activa</dt>
							<dd>{session.wakeLockActive ? 'sí' : 'no'}</dd>
						</div>
					</dl>
				{/if}
			</div>
		{/if}
	</main>

	<AppNav current={null} variant="dark" />
</div>

{#if session.photoFullscreen && photoSrc && currentPoint}
	<PhotoViewer
		src={photoSrc}
		alt={photoAlt}
		title={currentPoint.name}
		onClose={() => setPhotoFullscreen(false)}
	/>
{/if}

<style>
	.rec {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		/* The tour screen owns the whole viewport in navy, including behind
		   the inverted tab bar. */
		background: var(--ag-navy);
		padding-bottom: var(--ag-nav-inset-block);
		padding-left: var(--ag-nav-inset-inline);
	}

	.rec-bar {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px var(--ag-side) 8px;
	}

	/* Portrait: the wrapper disappears, so the state becomes the middle item
	   of the row and the title wraps onto a line of its own. */
	.rec-headline {
		display: contents;
	}

	.rec-round,
	.rec-round-spacer {
		width: var(--ag-target);
		height: var(--ag-target);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* The walking figure is drawn at 72 by 120, which is the size it needs on
	   the dev page. Here it is a status glyph in the header, so it is scaled
	   down to fit the same 44 px slot as the back button. */
	.rec-round-spacer {
		overflow: hidden;
	}

	.rec-round-spacer :global(.motion-wrap) {
		transform: scale(0.36);
	}

	.rec-round {
		background: rgba(255, 255, 255, 0.1);
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		text-decoration: none;
	}

	.rec-round:hover {
		background: rgba(255, 255, 255, 0.2);
		color: #ffffff;
	}

	.rec-state {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ag-green-on-navy);
	}

	.rec-state--idle {
		color: var(--ag-on-dark-2);
	}

	.rec-state-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-navy);
	}

	.rec-title {
		order: 3;
		width: 100%;
		margin: 2px 0 4px;
		font-size: 20px;
		font-weight: 800;
		line-height: 1.2;
		letter-spacing: -0.01em;
		text-align: center;
		color: #ffffff;
	}

	.rec-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 0 var(--ag-side) 14px;
		box-sizing: border-box;
	}

	.rec-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.rec-map-box {
		position: relative;
	}

	/* The frame wraps the photo rather than the column, so a portrait photo
	   does not sit inside two empty bars. Same white frame as the postcard. */
	.rec-photo-beside {
		margin: 12px 0 0;
		display: flex;
		justify-content: center;
	}

	.rec-photo-beside button {
		display: block;
		max-width: 100%;
		padding: 0;
		background: var(--ag-navy);
		border: 9px solid #ffffff;
		border-radius: 2px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
		box-sizing: border-box;
		cursor: pointer;
		line-height: 0;
	}

	.rec-photo-beside img {
		display: block;
		width: auto;
		max-width: 100%;
		max-height: 300px;
	}

	.rec-empty {
		margin: 0;
		color: var(--ag-on-dark-2);
	}

	.rec-warning,
	.rec-start-warning {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 10px 12px;
		background: rgba(255, 157, 148, 0.14);
		border: 1px solid rgba(255, 157, 148, 0.5);
		border-radius: var(--ag-r-sm);
		font-size: 13px;
		line-height: 1.45;
		color: var(--ag-danger-on-navy);
	}

	.rec-stop {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 9px;
		min-height: var(--ag-target);
		padding: 13px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		font-family: inherit;
		font-size: 14.5px;
		font-weight: 700;
		cursor: pointer;
		box-sizing: border-box;
	}

	.rec-stop:hover {
		background: rgba(255, 255, 255, 0.18);
	}

	.rec-start-block {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.rec-start-text {
		margin: 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--ag-on-dark-2);
	}

	.rec-start {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: var(--ag-target);
		padding: 16px;
		background: #ffffff;
		border: none;
		border-radius: var(--ag-r-md);
		color: var(--ag-navy);
		font-family: inherit;
		font-size: 16px;
		font-weight: 800;
		cursor: pointer;
	}

	.rec-start-icon {
		width: 34px;
		height: 34px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--ag-green-soft);
		border-radius: 50%;
		color: var(--ag-green-ink);
	}

	.rec-dev {
		margin: 0;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px dashed rgba(255, 255, 255, 0.28);
		border-radius: var(--ag-r-sm);
		font-size: 12px;
		color: var(--ag-on-dark-2);
	}

	.rec-dev div {
		display: flex;
		gap: 8px;
	}

	.rec-dev dt {
		font-weight: 700;
	}

	.rec-dev dt::after {
		content: ':';
	}

	.rec-dev dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	/* Landscape: map on the left, everything else in a column on the right,
	   because the height is what runs out. */
	@media (min-width: 600px) and (orientation: landscape) {
		.rec-bar {
			padding: 10px var(--ag-side-land) 6px;
		}

		/* Landscape: title and state stack in the middle of the header row,
		   which saves the whole title line. Those pixels are the difference
		   between the stop button being reachable and being below the fold. */
		.rec-bar {
			flex-wrap: nowrap;
			padding: 8px var(--ag-side-land) 4px;
		}

		.rec-headline {
			display: flex;
			flex-direction: column-reverse;
			align-items: center;
			gap: 1px;
			flex: 1;
			min-width: 0;
		}

		.rec-title {
			order: 0;
			width: auto;
			max-width: 100%;
			margin: 0;
			font-size: 16px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.rec-state {
			font-size: 10px;
		}

		.rec-body {
			flex-direction: row;
			align-items: stretch;
			gap: 20px;
			padding: 0 var(--ag-side-land) 12px;
			overflow: hidden;
		}

		.rec-map {
			flex: none;
			width: 46%;
			max-width: 462px;
			display: flex;
			flex-direction: column;
			align-items: stretch;
		}

		.rec-panel {
			flex: 1;
			min-width: 0;
			gap: 10px;
			padding-top: 2px;
			overflow-y: auto;
		}
	}

	@media (min-width: 840px) and (min-height: 600px) and (orientation: landscape) {
		.rec-title {
			font-size: 22px;
		}

		/* On tablet the photo has a place of its own under the map, so it is
		   never an overlay and the card button enlarges instead. */
		.rec-map {
			width: 50%;
			max-width: 700px;
			overflow-y: auto;
		}

		.rec-panel {
			gap: 16px;
		}
	}
</style>
