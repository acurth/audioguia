<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppNav from '$lib/components/ui/AppNav.svelte';
	import AudioPlayer from '$lib/components/ui/AudioPlayer.svelte';
	import CurrentPointCard from '$lib/components/ui/CurrentPointCard.svelte';
	import AgActionMark from '$lib/components/ui/AgActionMark.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import MovementIndicator from '$lib/components/MovementIndicator.svelte';
	import PhotoViewer from '$lib/components/ui/PhotoViewer.svelte';
	import PointPhoto from '$lib/components/ui/PointPhoto.svelte';
	import TrailMap from '$lib/components/ui/TrailMap.svelte';
	import { getDevModeFromStorage } from '$lib/data/tours';
	import { getTourViews } from '$lib/data/tourView';
	import { downloadStateStore, initOfflineStore } from '$lib/stores/offline';
	import type { DownloadState } from '$lib/stores/offline';
	import { readListOrigin } from '$lib/stores/listOrigin';
	import { formatClock } from '$lib/utils/time';
	import {
		closePhoto,
		cumulativeMeters,
		cyclePlaybackRate,
		playPoint,
		seekTo,
		selectPointForPlayback,
		sessionRestored,
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
	/**
	 * False until the app has checked for a saved walk. Until then this screen
	 * shows neither "En recorrido" nor "Sin iniciar", so a reload does not
	 * flash the start screen on its way to the walk that is actually running.
	 */
	let restored = $state($sessionRestored);
	/**
	 * True from the moment Detener is pressed until this screen goes away.
	 *
	 * Stopping resets the session and navigating takes a moment, so in between
	 * the screen would redraw itself as "Sin iniciar" and show the start
	 * button for about a second on the way out. Nobody who just pressed stop
	 * should be offered the start button.
	 */
	let leaving = $state(false);
	let downloadState = $state<Record<string, DownloadState>>({});
	// Measured, because the postcard size rule is in pixels.
	let mapWidth = $state(0);
	let mapHeight = $state(0);
	let isTabletLayout = $state(false);

	const detailHref = $derived(`${base}/${$page.params.track}`);
	const isOfflineReady = $derived(
		Boolean(tour?.id && downloadState[tour.id]?.status === 'downloaded')
	);
	const isThisTour = $derived(session.status === 'tracking' && session.slug === tour?.slug);
	/**
	 * Whether the screen may commit to "not running": only once the app has
	 * looked for a saved walk, and only while we are not on our way out.
	 * Both flickers this prevents are the same mistake — answering before the
	 * answer is known.
	 */
	const canShowIdle = $derived(restored && !leaving);
	const points = $derived(tour?.points ?? []);
	// Still needed for map navigation: tapping a marker sets the progress.
	const cumulative = $derived(cumulativeMeters(points));
	const elapsed = $derived(formatClock(session.elapsedMs / 1000));

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
	/** Every current point with a photo exposes the control. This includes the
	 * first point selected by default as soon as the walk starts, before GPS
	 * has produced a distance or the walker has tapped a map marker. */
	const canShowPhoto = $derived(isThisTour && !!photoSrc);
	const showOverlayPhoto = $derived(isThisTour && !!photoSrc && session.photoOpen);

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

	/**
	 * Leave first, stop second.
	 *
	 * Stopping resets the session, so doing it first left this screen with
	 * nothing to show — no card, no player, no stop button — for as long as
	 * the next route took to load, which on a phone is a noticeable blink.
	 * Navigating first keeps the walk on screen until the detail page is
	 * ready, the way any screen stays put until its replacement arrives, and
	 * the walk is stopped once this page is gone.
	 *
	 * `leaving` still guards the markup: if anything redraws this screen
	 * between the two steps, it must not offer the start button to someone who
	 * just pressed stop.
	 */
	async function handleStop() {
		leaving = true;

		// A tablet opens trail details beside the list, so return to that
		// master-detail screen instead of the standalone, phone-style detail
		// route. Include the stopped trail so its card and detail pane remain
		// selected. Phones still return to the standalone detail page.
		let target = detailHref;
		if (isTabletLayout) {
			const listHref = readListOrigin(base);
			target =
				listHref === `${base}/explorar` && tour
					? `${listHref}?recorrido=${encodeURIComponent(tour.slug)}`
					: listHref;
		}

		try {
			await goto(target);
		} finally {
			// Whatever the navigation did, the walk has to end. Leaving the GPS
			// watch and the wake lock running would be the worse bug.
			stopTour();
		}
	}

	function handlePlayCurrent() {
		if (!currentPoint) return;
		// Nothing loaded yet: the first tap starts this point rather than
		// resuming silence.
		if (!session.currentPointId) void playPoint(currentPoint, base);
		else togglePlay();
	}

	function handleSelectMapPoint(point: (typeof points)[number]) {
		if (!isThisTour) return;
		const index = points.findIndex((candidate) => candidate.id === point.id);
		selectPointForPlayback(point, base, cumulative[index] ?? 0);
	}

	onMount(() => {
		initOfflineStore();

		const tabletQuery = window.matchMedia(
			'(min-width: 840px) and (min-height: 600px) and (orientation: landscape)'
		);
		const syncLayout = () => {
			isTabletLayout = tabletQuery.matches;
		};
		syncLayout();
		tabletQuery.addEventListener('change', syncLayout);
		const stopSession = tourSession.subscribe((value) => {
			session = value;
		});
		const stopDownloads = downloadStateStore.subscribe((value) => {
			downloadState = value;
		});
		const stopRestored = sessionRestored.subscribe((value) => {
			restored = value;
		});
		return () => {
			stopSession();
			stopDownloads();
			stopRestored();
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
					<!-- The clock moved here when the trail progress bar went. It
					     was the one thing on that bar the map could not show. -->
					<span class="rec-elapsed">{elapsed}</span>
				</span>
			{:else if canShowIdle}
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
						onSelectPoint={isThisTour ? handleSelectMapPoint : undefined}
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
			</div>

			<!-- Tied to the measured width of the map so the card, the player and
			     the stop button form one column with it and nothing below the
			     map is ever wider than the map. `mapWidth` is already measured
			     for the photo overlay, so this costs no extra layout work. -->
			<div class="rec-panel" style={mapWidth > 0 ? `max-width:${mapWidth}px` : undefined}>
				{#if isThisTour}
					{#if currentPoint}
						<CurrentPointCard
							point={currentPoint}
							number={currentNumber}
							total={points.length}
							distance={currentDistance}
							photoOpen={session.photoOpen}
							showPhotoButton={canShowPhoto}
							onTogglePhoto={togglePhoto}
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

					<!-- Built to match Iniciar recorrido on the detail screen: same
					     corner radius, same mark at the same size, same text. The
					     only differences are the glyph it pairs with the walker and
					     the background, which is explained on .rec-stop below. -->
					<button type="button" class="rec-stop" onclick={handleStop}>
						<span class="rec-stop-icon">
							<AgActionMark action="trail-stop" size="sm" skin="navy" />
						</span>
						<span class="rec-stop-text">Detener recorrido</span>
					</button>
				{:else if canShowIdle}
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
							<span class="rec-start-icon"
								><AgActionMark action="trail-start" size="sm" skin="green" /></span
							>
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

	<AppNav current="explorar" variant="dark" />
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
		font-size: 13.5px;
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

	/* White rather than green: it is a number, not part of the running state,
	   and the tracking colour should stay on the label and the dot. */
	.rec-elapsed {
		padding-left: 7px;
		border-left: 1px solid rgba(255, 255, 255, 0.24);
		color: #ffffff;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
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
		min-width: 0;
		/* Centred inside whatever room it has, so capping it to the map width
		   leaves even margins rather than a gap on one side. */
		margin-inline: auto;
		width: 100%;
	}

	.rec-map-box {
		position: relative;
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

	/* Mirrors .td-start on the detail screen, with one deliberate difference:
	   that button is navy on a white page, and this screen is already navy,
	   so the same colour would make the button disappear. It uses the raised
	   panel navy instead — the same surface as the point card above it, which
	   is how a raised control reads on this background. */
	.rec-stop {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: var(--ag-target);
		padding: 18px;
		background: var(--ag-navy-panel);
		border: none;
		border-radius: var(--ag-r-md);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
		color: #ffffff;
		font-family: inherit;
		cursor: pointer;
		box-sizing: border-box;
	}

	.rec-stop:hover {
		background: #20496a;
	}

	.rec-stop-icon {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.rec-stop-text {
		font-size: 16px;
		font-weight: 800;
		letter-spacing: 0.01em;
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
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
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
		   which saves the whole title line. The padding was squeezed to 8 and 4
		   when the stop button was at risk of falling below the fold; it no
		   longer is, and the screen had ended up looking crushed against the
		   top edge. */
		.rec-bar {
			flex-wrap: nowrap;
			padding: 14px var(--ag-side-land) 10px;
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
			font-size: 12px;
		}

		/* The top padding is not decoration. The point photo is built to
		   overhang the map by 4 px, and its close button sits 15 px beyond
		   that again. With no padding here and overflow hidden, those 19 px
		   were clipped and the control to close the photo was half gone. */
		.rec-body {
			flex-direction: row;
			align-items: stretch;
			gap: 20px;
			padding: 14px var(--ag-side-land) 16px;
			overflow: hidden;
		}

		/* In landscape the map is sized from the height, not the width. Its
		   ratio is fixed at 398/300 and cannot be bent: the Mapbox image is
		   requested at exactly that shape and our numbered markers are placed
		   with the same projection, so any other ratio would slide the markers
		   off the paths. Deriving the width from the available height keeps
		   the ratio, fills the column instead of leaving a void under it, and
		   on a phone in landscape stops the map from being taller than the
		   room it has.
		   The vertical padding is the clearance the point photo needs: it
		   overhangs the map by 4 px and its close button sits 15 px beyond
		   that again. */
		.rec-map {
			flex: none;
			width: 46%;
			max-width: 462px;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: center;
			padding-block: 20px;
			box-sizing: border-box;
		}

		.rec-map-box {
			aspect-ratio: 398 / 300;
			height: 100%;
			width: auto;
			max-width: 100%;
			margin-inline: auto;
		}

		/* The stop button goes to the foot of its column. It is the last thing
		   on the screen and the one most often reached for, and it is what
		   turns the space under the player from a void into breathing room. */
		.rec-panel {
			flex: 1;
			min-width: 0;
			gap: 14px;
			padding-top: 0;
			overflow-y: auto;
		}

		.rec-stop {
			margin-top: auto;
		}

		/* Same trim as .td-start takes in landscape. */
		.rec-stop {
			padding: 14px;
		}

		.rec-stop-text {
			font-size: 15px;
		}
	}

	@media (min-width: 840px) and (min-height: 600px) and (orientation: landscape) {
		.rec-title {
			font-size: 22px;
		}

		.rec-map {
			width: 50%;
			max-width: 700px;
		}

		.rec-panel {
			gap: 20px;
		}
	}
</style>
