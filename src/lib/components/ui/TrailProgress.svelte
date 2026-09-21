<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatKm } from '$lib/utils/tourMeta';
	import { formatClock } from '$lib/utils/time';
	import type { TourPoint } from '$lib/utils/tourMeta';

	/**
	 * Progress along the whole trail, distinct from the audio scrubber. Start
	 * on the left, destination on the right, one tick per point, and a head
	 * that follows the walker, backwards too when they turn around.
	 */
	type Props = {
		points: TourPoint[];
		/** Cumulative metres from the first point to each point. */
		cumulative: number[];
		walkedMeters: number;
		totalMeters: number;
		heardCount: number;
		elapsedMs: number;
		/** Hides the heading row where the height is scarce. */
		compact?: boolean;
	};

	let {
		points,
		cumulative,
		walkedMeters,
		totalMeters,
		heardCount,
		elapsedMs,
		compact = false
	}: Props = $props();

	const fraction = $derived(totalMeters > 0 ? Math.min(walkedMeters / totalMeters, 1) : 0);
	const percent = $derived(fraction * 100);
	const elapsed = $derived(formatClock(elapsedMs / 1000));
	const destination = $derived(points.at(-1)?.name ?? 'Final');

	const valueText = $derived(
		`${formatKm(walkedMeters)} de ${formatKm(totalMeters)}. ` +
			`${heardCount} de ${points.length} puntos escuchados. ${elapsed} caminando.`
	);
</script>

<div class="tp">
	{#if !compact}
		<div class="tp-head">
			<span class="tp-eyebrow">Avance del sendero</span>
			<span class="tp-clock">
				<Icon name="clock" size={13} stroke={2.2} />
				{elapsed}
			</span>
		</div>
	{/if}

	<!--
		This reports progress, it does not take input: the redesign draws a
		draggable head, but dragging it would mean claiming to have walked
		somewhere you have not. So it is a progressbar, not a slider, and the
		head still moves with the walker.
	-->
	<div
		class="tp-track"
		role="progressbar"
		aria-label="Avance del sendero"
		aria-valuemin={0}
		aria-valuemax={Math.round(totalMeters)}
		aria-valuenow={Math.round(walkedMeters)}
		aria-valuetext={valueText}
	>
		<span class="tp-fill" style={`width:${percent.toFixed(1)}%`}></span>

		{#each points as point, index (point.id)}
			{@const tickPercent = totalMeters > 0 ? (cumulative[index] / totalMeters) * 100 : 0}
			<span
				class="tp-tick"
				class:is-heard={index < heardCount}
				style={`left:${tickPercent.toFixed(1)}%`}
				aria-hidden="true"
			></span>
		{/each}

		<span class="tp-head-dot" style={`left:${percent.toFixed(1)}%`} aria-hidden="true">
			<span></span>
		</span>
	</div>

	<p class="tp-summary">
		<span class="tp-end">Inicio</span>
		<span class="tp-numbers">
			{formatKm(walkedMeters)} de {formatKm(totalMeters)} · {elapsed} · {heardCount} de {points.length}
			puntos
		</span>
		<span class="tp-end">{destination}</span>
	</p>
</div>

<style>
	.tp {
		flex: none;
	}

	.tp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 9px;
	}

	.tp-eyebrow {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ag-on-dark-2);
	}

	.tp-clock {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12.5px;
		font-weight: 700;
		color: #ffffff;
		font-variant-numeric: tabular-nums;
	}

	.tp-track {
		position: relative;
		height: 6px;
		border-radius: var(--ag-r-pill);
		background: rgba(255, 255, 255, 0.18);
	}

	/* The brand green gives only 1.98:1 against the track behind it, so the
	   filled part would be hard to see. The lighter green clears 3:1. */
	.tp-fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-panel);
		transition: width var(--ag-motion) var(--ag-ease);
	}

	.tp-tick {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		border-radius: var(--ag-r-pill);
		background: #ffffff;
		opacity: 0.38;
		transform: translate(-50%, -50%);
	}

	.tp-tick.is-heard {
		width: 8px;
		height: 8px;
		opacity: 1;
	}

	.tp-head-dot {
		position: absolute;
		top: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: var(--ag-r-pill);
		background: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
		transform: translate(-50%, -50%);
		transition: left var(--ag-motion) var(--ag-ease);
	}

	.tp-head-dot span {
		width: 8px;
		height: 8px;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green-on-navy);
	}

	.tp-summary {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 7px 0 0;
		font-size: 11.5px;
		color: var(--ag-on-dark-3);
	}

	.tp-end {
		flex: none;
		max-width: 28%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tp-numbers {
		flex: 1;
		text-align: center;
		color: #ffffff;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	/* In landscape the heading row goes: the summary underneath already says
	   the time, and those 26 px decide whether the stop button fits without
	   scrolling. */
	@media (min-width: 600px) and (orientation: landscape) {
		.tp-head {
			display: none;
		}
	}
</style>
