<script lang="ts">
	import AgActionMark from '$lib/components/ui/AgActionMark.svelte';
	import { formatClock, spokenDuration } from '$lib/utils/time';

	/**
	 * The scrubber and the transport row for the narration of one point.
	 * Unlike the trail progress, seeking here is a real action, so the
	 * scrubber is a real slider: it answers taps, drags and the arrow keys.
	 *
	 * The scrubber keeps the full width and the transport sits underneath.
	 * Splitting the row in half would have left about 160 px for each, which
	 * is too little to drag accurately and too little for four controls.
	 */
	type Props = {
		pointLabel: string;
		isPlaying: boolean;
		currentTime: number;
		duration: number;
		playbackRate: number;
		onTogglePlay: () => void;
		onSeek: (seconds: number) => void;
		onSkip: (delta: number) => void;
		onCycleRate: () => void;
	};

	let {
		pointLabel,
		isPlaying,
		currentTime,
		duration,
		playbackRate,
		onTogglePlay,
		onSeek,
		onSkip,
		onCycleRate
	}: Props = $props();

	const percent = $derived(duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0);
	const rateLabel = $derived(`${String(playbackRate).replace('.', ',')}×`);

	/**
	 * The label that rides along under the knob. Clamped away from both ends
	 * so it never hangs outside the bar at 0:00 or at the very end.
	 */
	const nowLeft = $derived(`clamp(20px, ${percent.toFixed(1)}%, calc(100% - 20px))`);

	const valueText = $derived(
		duration > 0
			? `${spokenDuration(currentTime)} de ${spokenDuration(duration)}`
			: 'Sin audio cargado'
	);

	/** Drives the larger knob, so a finger on the bar is visibly in control. */
	let isScrubbing = $state(false);

	function handleKey(event: KeyboardEvent) {
		const step = event.shiftKey ? 30 : 5;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
			event.preventDefault();
			onSeek(currentTime + step);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
			event.preventDefault();
			onSeek(currentTime - step);
		} else if (event.key === 'Home') {
			event.preventDefault();
			onSeek(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			onSeek(duration);
		}
	}

	function seekFromPointer(event: PointerEvent, track: HTMLElement) {
		const rect = track.getBoundingClientRect();
		if (rect.width === 0 || duration === 0) return;
		const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		onSeek(ratio * duration);
	}

	/**
	 * Pointer capture is what makes the drag survive leaving the bar: without
	 * it the first move outside those few pixels would end the gesture, which
	 * on a phone is most of them.
	 */
	function handlePointerDown(event: PointerEvent) {
		const track = event.currentTarget as HTMLElement;
		track.setPointerCapture(event.pointerId);
		isScrubbing = true;
		seekFromPointer(event, track);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!isScrubbing) return;
		event.preventDefault();
		seekFromPointer(event, event.currentTarget as HTMLElement);
	}

	function endScrub(event: PointerEvent) {
		if (!isScrubbing) return;
		isScrubbing = false;
		const track = event.currentTarget as HTMLElement;
		if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
	}
</script>

<div class="ap">
	<div class="ap-head">
		<span class="ap-eyebrow">{pointLabel}</span>
		{#if isPlaying}
			<span class="ap-state">
				<span class="ap-dot" aria-hidden="true"></span>
				Reproduciendo
			</span>
		{:else}
			<span class="ap-state ap-state--paused">En pausa</span>
		{/if}
	</div>

	<div class="ap-scrub">
		<div
			class="ap-track"
			class:is-scrubbing={isScrubbing}
			role="slider"
			tabindex="0"
			aria-label="Avance del relato"
			aria-valuemin={0}
			aria-valuemax={Math.round(duration)}
			aria-valuenow={Math.round(currentTime)}
			aria-valuetext={valueText}
			onkeydown={handleKey}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={endScrub}
			onpointercancel={endScrub}
		>
			<span class="ap-fill" style={`width:${percent.toFixed(1)}%`}></span>
			<span class="ap-knob" style={`left:${percent.toFixed(1)}%`} aria-hidden="true"></span>
		</div>

		<!-- Rides under the knob. The slider already announces the same thing
		     through aria-valuetext, so this is decorative. -->
		<span class="ap-now" style={`left:${nowLeft}`} aria-hidden="true">
			{formatClock(currentTime)}
		</span>
	</div>

	<div class="ap-transport">
		<button
			type="button"
			class="ap-rate"
			aria-label={`Velocidad de reproducción: ${rateLabel}. Tocá para cambiarla.`}
			onclick={onCycleRate}
		>
			{rateLabel}
		</button>

		<button
			type="button"
			class="ap-skip"
			aria-label="Retroceder 15 segundos"
			onclick={() => onSkip(-15)}
		>
			<svg
				viewBox="0 0 24 24"
				width="32"
				height="32"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
				<path d="M3 4v4h4"></path>
			</svg>
			<span class="ap-skip-number" aria-hidden="true">15</span>
		</button>

		<!-- The mark carries its own pill, so the button behind it is bare.
		     A white disc around it made two shapes competing for the same job. -->
		<button
			type="button"
			class="ap-play"
			aria-label={isPlaying ? 'Pausar el relato' : `Escuchar el relato de ${pointLabel}`}
			aria-pressed={isPlaying}
			onclick={onTogglePlay}
		>
			<AgActionMark action={isPlaying ? 'audio-pause' : 'audio-play'} size="xl" skin="green" />
		</button>

		<!-- Forward matches back at 15 seconds. The podcast convention is 30,
		     but these narrations run one to three minutes, so 30 would jump a
		     quarter of the point. -->
		<button
			type="button"
			class="ap-skip"
			aria-label="Adelantar 15 segundos"
			onclick={() => onSkip(15)}
		>
			<svg
				viewBox="0 0 24 24"
				width="32"
				height="32"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path>
				<path d="M21 4v4h-4"></path>
			</svg>
			<span class="ap-skip-number" aria-hidden="true">15</span>
		</button>

		<!-- The total, fixed. The figure that moves is under the knob, so this
		     one is a stable reference for how long the point lasts. -->
		<span class="ap-total">{formatClock(duration)}</span>
	</div>
</div>

<style>
	/* The transport row holds fixed-width controls. Without this the row can
	   push the whole player wider than the map and the card above it.
	   The inline padding pulls everything a further 10 px in from each side,
	   which also keeps the scrubber knob inside the panel: it is centred on
	   the bar's end, so at 0:00 half of it used to hang over the edge. */
	.ap {
		min-width: 0;
		max-width: 100%;
		padding-inline: 10px;
		box-sizing: border-box;
	}

	.ap-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 3px;
	}

	.ap-eyebrow {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ag-on-dark-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ap-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex: none;
		font-size: 11.5px;
		font-weight: 700;
		color: var(--ag-green-on-navy);
	}

	.ap-state--paused {
		color: var(--ag-on-dark-2);
	}

	.ap-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-navy);
	}

	.ap-scrub {
		position: relative;
		margin-bottom: 2px;
	}

	.ap-track {
		position: relative;
		height: 5px;
		border-radius: var(--ag-r-pill);
		background: rgba(255, 255, 255, 0.18);
		cursor: pointer;
		/* A 5 px bar is far too thin to hit. The padding box gives it a 44 px
		   target without changing how it looks.
		   The padding is lopsided on purpose: the target stays 44 px, but the
		   weight moves below the bar, which pulls the bar up towards the
		   heading and leaves room underneath for the elapsed figure. */
		padding-top: 11px;
		padding-bottom: 28px;
		background-clip: content-box;
		/* Without this the browser treats a drag along the bar as a page
		   scroll and the scrubber never receives the move events. */
		touch-action: none;
	}

	.ap-fill {
		position: absolute;
		top: 11px;
		bottom: 28px;
		left: 0;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-panel);
	}

	/* Sits on the bar, which is no longer the middle of the box now that the
	   padding is lopsided. 11 px of padding plus half of the 5 px bar. */
	.ap-knob {
		position: absolute;
		top: 13.5px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
		transform: translate(-50%, -50%);
		transition:
			width var(--ag-motion) var(--ag-ease),
			height var(--ag-motion) var(--ag-ease);
	}

	.ap-track.is-scrubbing .ap-knob {
		width: 20px;
		height: 20px;
	}

	.ap-track:focus-visible {
		outline: 3px solid #ffffff;
		outline-offset: 4px;
	}

	/* Sits in the lower padding of the track's own 44 px hit box, so it costs
	   the layout no extra height. */
	.ap-now {
		position: absolute;
		/* Low enough that the knob clears it, including at the 20 px it grows
		   to while being dragged. */
		bottom: 4px;
		transform: translateX(-50%);
		font-size: 11.5px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #ffffff;
		white-space: nowrap;
		pointer-events: none;
	}

	.ap-transport {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}

	.ap-rate,
	.ap-total {
		/* Shrinkable rather than fixed: on the narrowest phone these two give
		   way before the row can overflow the panel. */
		flex: 0 1 auto;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.ap-rate {
		height: var(--ag-target);
		padding: 0 12px;
		background: rgba(255, 255, 255, 0.12);
		border: none;
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		font-family: inherit;
		cursor: pointer;
	}

	.ap-rate:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	/* Balances the speed pill on the other end of the row, so the play button
	   stays in the middle. */
	.ap-total {
		text-align: right;
		color: var(--ag-on-dark-2);
	}

	.ap-skip {
		position: relative;
		width: var(--ag-target);
		height: var(--ag-target);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #ffffff;
		cursor: pointer;
	}

	.ap-skip-number {
		position: absolute;
		font-size: 9px;
		font-weight: 800;
	}

	.ap-play {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: none;
		border: none;
		border-radius: var(--ag-r-pill);
		cursor: pointer;
	}

	.ap-play:hover :global(.ag-action-mark) {
		filter: brightness(1.06);
	}

	.ap-rate:focus-visible,
	.ap-skip:focus-visible,
	.ap-play:focus-visible {
		outline: 3px solid #ffffff;
		outline-offset: 3px;
	}

	/* Landscape: the row loses height, so the scrubber's hit area shrinks with
	   it and the transport tightens. */
	@media (min-width: 600px) and (orientation: landscape) {
		.ap-head {
			margin-bottom: 2px;
		}

		.ap-track {
			padding-top: 9px;
			padding-bottom: 24px;
		}

		.ap-fill {
			top: 9px;
			bottom: 24px;
		}

		.ap-knob {
			top: 11.5px;
		}

		.ap-now {
			bottom: 3px;
		}
	}
</style>
