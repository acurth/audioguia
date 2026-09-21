<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatClock, spokenDuration } from '$lib/utils/time';

	/**
	 * The scrubber and the transport row for the narration of one point.
	 * Unlike the trail progress, seeking here is a real action, so the
	 * scrubber is a real slider and answers the arrow keys.
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
	const remaining = $derived(Math.max(duration - currentTime, 0));
	const rateLabel = $derived(`${String(playbackRate).replace('.', ',')}×`);

	const valueText = $derived(
		duration > 0
			? `${spokenDuration(currentTime)} de ${spokenDuration(duration)}`
			: 'Sin audio cargado'
	);

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

	function handlePointer(event: PointerEvent) {
		const track = event.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		if (rect.width === 0 || duration === 0) return;
		const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		onSeek(ratio * duration);
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

	<div
		class="ap-track"
		role="slider"
		tabindex="0"
		aria-label="Avance del relato"
		aria-valuemin={0}
		aria-valuemax={Math.round(duration)}
		aria-valuenow={Math.round(currentTime)}
		aria-valuetext={valueText}
		onkeydown={handleKey}
		onpointerdown={handlePointer}
	>
		<span class="ap-fill" style={`width:${percent.toFixed(1)}%`}></span>
		<span class="ap-knob" style={`left:${percent.toFixed(1)}%`} aria-hidden="true"></span>
	</div>

	<p class="ap-times">
		<span class="ap-elapsed">{formatClock(currentTime)}</span>
		<span class="ap-remaining">-{formatClock(remaining)}</span>
	</p>

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

		<button
			type="button"
			class="ap-play"
			aria-label={isPlaying ? 'Pausar el relato' : 'Reproducir el relato'}
			aria-pressed={isPlaying}
			onclick={onTogglePlay}
		>
			<Icon name={isPlaying ? 'pause' : 'play'} size={26} />
		</button>

		<button
			type="button"
			class="ap-skip"
			aria-label="Adelantar 30 segundos"
			onclick={() => onSkip(30)}
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
			<span class="ap-skip-number" aria-hidden="true">30</span>
		</button>

		<span class="ap-balance" aria-hidden="true"></span>
	</div>
</div>

<style>
	.ap-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
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

	.ap-track {
		position: relative;
		height: 5px;
		margin-bottom: 9px;
		border-radius: var(--ag-r-pill);
		background: rgba(255, 255, 255, 0.18);
		cursor: pointer;
		/* A 5 px bar is far too thin to hit. The padding box gives it a
		   44 px target without changing how it looks. */
		padding-block: 19px;
		background-clip: content-box;
	}

	.ap-fill {
		position: absolute;
		top: 19px;
		bottom: 19px;
		left: 0;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-panel);
	}

	.ap-knob {
		position: absolute;
		top: 50%;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
		transform: translate(-50%, -50%);
	}

	.ap-times {
		display: flex;
		justify-content: space-between;
		margin: 0 0 18px;
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.ap-elapsed {
		color: #ffffff;
	}

	.ap-remaining {
		color: var(--ag-on-dark-2);
	}

	.ap-transport {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.ap-rate,
	.ap-balance {
		min-width: 46px;
		flex: none;
	}

	.ap-rate {
		height: var(--ag-target);
		padding: 0 12px;
		background: rgba(255, 255, 255, 0.12);
		border: none;
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 700;
		cursor: pointer;
	}

	.ap-rate:hover {
		background: rgba(255, 255, 255, 0.2);
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
		width: 66px;
		height: 66px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: none;
		border-radius: 50%;
		color: var(--ag-navy);
		cursor: pointer;
	}

	.ap-play:hover {
		background: var(--ag-green-soft);
	}

	/* Landscape: the row loses height, so the main button shrinks and the
	   hit area of the scrubber shrinks with the touch target token. */
	@media (min-width: 600px) and (orientation: landscape) {
		.ap-times {
			margin: 0 0 6px;
		}

		.ap-head {
			margin-bottom: 4px;
		}

		.ap-play {
			width: 54px;
			height: 54px;
		}

		.ap-track {
			padding-block: 16px;
		}

		.ap-fill {
			top: 16px;
			bottom: 16px;
		}
	}
</style>
