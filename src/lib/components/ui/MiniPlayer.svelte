<script lang="ts">
	import { base } from '$app/paths';
	import AgActionMark from '$lib/components/ui/AgActionMark.svelte';
	import { pointOnDeck, type TourSessionState } from '$lib/stores/tourSession';
	import { formatClock, spokenDuration } from '$lib/utils/time';

	/**
	 * The bar above the tab bar while a walk is in progress. It exists
	 * because the narration keeps playing when the person leaves the tour
	 * screen, so they need a way back into it and a way to pause.
	 */
	type Props = {
		session: TourSessionState;
		onTogglePlay: () => void;
		onStop: () => void;
	};

	let { session, onTogglePlay, onStop }: Props = $props();

	// The same point the Recorrido screen shows: before any point fires, the
	// first one, ready to play.
	const point = $derived(pointOnDeck(session.points, session.currentPointId, session.triggeredIds));
	/** Position of the point on deck, the same number Recorrido shows. */
	const audioNumber = $derived(point ? session.points.findIndex((p) => p.id === point.id) + 1 : 0);
	// The same walk clock the Recorrido screen shows in its header.
	const elapsedSeconds = $derived(session.elapsedMs / 1000);
	const percent = $derived(
		session.duration > 0 ? Math.min((session.currentTime / session.duration) * 100, 100) : 0
	);
	// Before the first geolocated narration fires there is no current point.
	// Keep the mini player identifiable with the trail cover, then prefer the
	// current point photo once one is active.
	const photoPath = $derived(point?.photos?.[0] ?? session.imagePath);
	const photo = $derived(photoPath ? `${base}/${photoPath}` : null);
</script>

<div class="mp">
	<div class="mp-row">
		<a class="mp-link" href={`${base}/${session.slug}/recorrido`}>
			{#if photo}
				<img src={photo} alt="" width="40" height="40" />
			{:else}
				<span class="mp-thumb-empty" aria-hidden="true"></span>
			{/if}
			<span class="mp-text">
				<span class="mp-point">
					{#if point}{point.id} · {point.name}{:else}{session.name}{/if}
				</span>
				<span class="mp-meta">
					<span class="mp-state">
						<span class="mp-dot" aria-hidden="true"></span>
						En recorrido
					</span>
					<!-- Screen readers read "12:34" as a time of day, so they get
					     the duration in words instead. -->
					<span class="mp-elapsed" aria-hidden="true">{formatClock(elapsedSeconds)}</span>
					<span class="sr-only">, {spokenDuration(elapsedSeconds)}.</span>
				</span>
				<span class="mp-audio">
					<span class="mp-audio-count">Audio {audioNumber} de {session.points.length}</span>
					<!-- Shows progress only. Seeking is on the Recorrido screen. -->
					<span class="mp-bar" aria-hidden="true">
						<span style={`width:${percent.toFixed(1)}%`}></span>
					</span>
					<span class="mp-duration" aria-hidden="true">{formatClock(session.duration)}</span>
				</span>
			</span>
			<span class="sr-only">Volver al recorrido en curso</span>
		</a>

		<div class="mp-controls">
			<button
				type="button"
				class="mp-play"
				aria-label={session.isPlaying
					? 'Pausar el relato'
					: `Escuchar el relato de ${point?.name ?? session.name}`}
				aria-pressed={session.isPlaying}
				onclick={onTogglePlay}
			>
				<AgActionMark
					action={session.isPlaying ? 'audio-pause' : 'audio-play'}
					size="sm"
					skin="navy"
				/>
			</button>

			<button type="button" class="mp-stop" aria-label="Detener recorrido" onclick={onStop}>
				<AgActionMark action="trail-stop" size="sm" skin="navy" />
			</button>
		</div>
	</div>
</div>

<style>
	.mp {
		position: fixed;
		inset: auto var(--ag-app-gutter) var(--ag-nav-inset-block)
			calc(var(--ag-app-gutter) + var(--ag-nav-inset-inline));
		z-index: 39;
		background: var(--ag-navy);
		box-shadow: 0 -8px 24px rgba(16, 44, 68, 0.28);
	}

	.mp-row {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 9px 14px;
	}

	.mp-link {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 11px;
		min-height: var(--ag-target);
		color: #ffffff;
		text-decoration: none;
	}

	.mp-link img,
	.mp-thumb-empty {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 5px;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.12);
	}

	.mp-text {
		flex: 1;
		min-width: 0;
	}

	.mp-point {
		display: block;
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mp-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 3px;
		min-width: 0;
	}

	.mp-state {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex: none;
		font-size: 11px;
		font-weight: 700;
		color: var(--ag-green-on-navy);
	}

	.mp-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-navy);
	}

	.mp-elapsed {
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--ag-on-dark-2);
	}

	.mp-audio {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
		min-width: 0;
		font-size: 11px;
		color: var(--ag-on-dark-2);
	}

	.mp-audio-count {
		flex: none;
		white-space: nowrap;
	}

	/* The same colours as the bar on Detalle, without the knob or the time
	   under it: here it only shows how far the audio has gone. */
	.mp-bar {
		position: relative;
		flex: 1;
		min-width: 24px;
		height: 4px;
		border-radius: var(--ag-r-pill);
		background: rgba(255, 255, 255, 0.18);
		overflow: hidden;
	}

	.mp-bar span {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-panel);
	}

	.mp-duration {
		flex: none;
		font-variant-numeric: tabular-nums;
	}

	.mp-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
	}

	.mp-stop,
	.mp-play {
		width: 52px;
		height: var(--ag-target);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--ag-r-pill);
		cursor: pointer;
	}

	.mp-stop {
		background: transparent;
		border: none;
		color: #ffffff;
	}

	.mp-play {
		background: transparent;
		border: none;
		color: #ffffff;
	}

	.mp-stop:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.mp-play:hover {
		background: rgba(255, 255, 255, 0.08);
	}
</style>
