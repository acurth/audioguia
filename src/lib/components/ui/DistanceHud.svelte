<script lang="ts">
	import { untrack } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { compass, enableCompass } from '$lib/stores/compass';
	import { bearingDegrees, distanceBand, formatDistance, hudTarget } from '$lib/utils/distanceHud';
	import { distanceMeters, type TourPoint } from '$lib/utils/tourMeta';

	/**
	 * The small navy box in the lower right of the trail map: an arrow, the
	 * distance, and which point it is. From the Claude Design handoff
	 * "Distancias sobre el mapa", option D.
	 *
	 * Until it is tapped the box is a button: a compass icon and "Tocá para
	 * la brújula", with the distance as usual. Motion access is asked for in
	 * that tap and nowhere else, so nobody gets a second prompt straight after
	 * the location one without knowing what it is for. A reload asks again on
	 * the next tap.
	 *
	 * With a compass the arrow points where to walk, from the top of the
	 * phone: turn around and it turns too. Without one (refused, or a
	 * computer) it points the way on the map, which is north up, and the
	 * circle is drawn as an outline with "en el mapa" in the label so the
	 * companion can tell the two apart. The map itself never rotates.
	 *
	 * Smaller than the handoff, at Axel's request: at most 46 px tall and
	 * 156 px wide. Measured on 2026-09-30, that clears every point number of
	 * the three published trails, on phone and iPad, in both orientations.
	 * The tightest is Cascada de los Duendes, point 06, on a phone in
	 * landscape. A new trail needs the same check. The test trail "vuelta por
	 * casa" has points 11 and 12 in the corner and is covered; that is accepted.
	 */
	type Props = {
		points: TourPoint[];
		triggeredIds: string[];
		position: { lat: number; lng: number; accuracy: number } | null;
	};

	let { points, triggeredIds, position }: Props = $props();

	/** Closer than this, or than the GPS error, the direction means nothing. */
	const ARRIVE_METERS = 15;

	const target = $derived(hudTarget(points, triggeredIds));
	const meters = $derived(target && position ? distanceMeters(position, target.point) : null);
	const bearing = $derived(target && position ? bearingDegrees(position, target.point) : 0);
	const arriving = $derived(
		meters != null && position != null && meters <= Math.max(ARRIVE_METERS, position.accuracy)
	);
	const distance = $derived(meters != null ? formatDistance(meters) : null);
	const useCompass = $derived($compass.active && $compass.heading != null);
	/** Not asked yet, or waiting for the answer: the box invites a tap. */
	const invite = $derived($compass.status === 'off' || $compass.status === 'asking');

	const label = $derived.by(() => {
		if (!target) return '';
		if (arriving) return `llegando al ${target.number}`;
		// "Tocá para usar la brújula" is 116 px and the box has room for 99.
		if (invite) return $compass.status === 'asking' ? 'Activando…' : 'Tocá para la brújula';
		// Map mode says "en el mapa" in a shorter label than the handoff's
		// "hasta el 07 · según el mapa", which does not fit the smaller box.
		if (!useCompass) return `al ${target.number} · en el mapa`;
		return target.isStart ? `hasta el inicio, ${target.number}` : `hasta el ${target.number}`;
	});

	/**
	 * Kept unwrapped, so going from 359° to 1° turns the arrow 2° and not 358°
	 * the long way round.
	 */
	let rotation = $state(0);
	$effect(() => {
		const want = useCompass ? bearing - ($compass.heading ?? 0) : bearing;
		untrack(() => {
			const delta = ((((want - rotation) % 360) + 540) % 360) - 180;
			if (Math.abs(delta) > 0.05) rotation += delta;
		});
	});

	/**
	 * The numbers change every second, so they are hidden from screen readers.
	 * This line changes only with the point or the distance band.
	 */
	let spoken = $state('');
	let lastBand = '';
	$effect(() => {
		if (!target || meters == null || !distance) return;
		const band = `${target.number}|${distanceBand(meters)}`;
		if (band === lastBand) return;
		lastBand = band;
		const unit = distance.unit === 'm' ? 'metros' : 'kilómetros';
		spoken = `Punto ${target.number}, ${distance.value} ${unit}`;
	});
</script>

{#snippet contents(shown: { value: string; unit: string })}
	<span class="dhud-arrow" aria-hidden="true">
		{#if arriving}
			<span class="dhud-dot"></span>
		{:else if invite}
			<!-- Not an arrow: a fixed arrow would read as "walk straight on". -->
			<Icon name="compass" size={19} stroke={2.2} />
		{:else}
			<svg viewBox="0 0 24 24" style={`transform: rotate(${rotation.toFixed(1)}deg)`}>
				<path d="M12 2 20 21 12 16.5 4 21z" />
			</svg>
		{/if}
	</span>
	<span class="dhud-text" aria-hidden="true">
		<span class="dhud-value">{shown.value}<span class="dhud-unit">{shown.unit}</span></span>
		<span class="dhud-label">{label}</span>
	</span>
	<span class="sr-only" role="status" aria-live="polite">{spoken}</span>
{/snippet}

{#if target && distance}
	{#if invite}
		<button
			type="button"
			class="dhud dhud--invite dhud--mapmode"
			class:dhud--ontrail={!target.isStart}
			class:dhud--arriving={arriving}
			aria-label="Usar la brújula para ver hacia dónde caminar"
			onclick={enableCompass}
		>
			{@render contents(distance)}
		</button>
	{:else}
		<div
			class="dhud"
			class:dhud--ontrail={!target.isStart}
			class:dhud--arriving={arriving}
			class:dhud--mapmode={!useCompass}
		>
			{@render contents(distance)}
		</div>
	{/if}
{/if}

<style>
	/* The handoff's look, scaled down: 46 px tall instead of 58. */
	.dhud {
		position: absolute;
		right: 10px;
		bottom: 10px;
		z-index: 2; /* over the map and its markers, under the photo popup */
		height: 46px;
		min-width: 128px; /* the width stays put while the numbers change */
		max-width: 156px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px 6px 7px;
		background: var(--ag-navy); /* flat, no gradient */
		border-radius: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
		pointer-events: none; /* map gestures and markers stay usable */
		margin: 0;
		border: none;
		font: inherit;
		text-align: start;
	}

	/* The one state that takes taps. */
	.dhud--invite {
		pointer-events: auto;
		cursor: pointer;
	}

	.dhud--invite:focus-visible {
		outline: 3px solid #ffffff;
		outline-offset: 2px;
	}

	.dhud--invite .dhud-arrow {
		color: var(--ag-green-on-navy);
	}

	.dhud--invite .dhud-label {
		color: #ffffff;
	}

	.dhud-arrow {
		flex: none;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--ag-r-pill);
		background: var(--ag-green);
	}

	.dhud-arrow svg {
		display: block;
		width: 19px;
		height: 19px;
		fill: #ffffff;
		will-change: transform;
	}

	/* No compass: an outline, so the arrow reads as "on the map", not "walk
	   this way". */
	.dhud--mapmode .dhud-arrow {
		background: transparent;
		box-shadow: inset 0 0 0 2px var(--ag-green-on-navy);
	}

	/* Arriving: the direction is unreliable this close, so a pulsing dot
	   replaces the arrow. */
	.dhud-dot {
		width: 10px;
		height: 10px;
		border-radius: var(--ag-r-pill);
		background: #ffffff;
		animation: dhud-pulse 1.6s ease-out infinite;
	}

	@keyframes dhud-pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6);
		}
		100% {
			box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dhud-dot {
			animation: none;
		}
	}

	.dhud-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.dhud-value {
		color: #ffffff;
		font-size: 20px;
		font-weight: 900;
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums; /* digits keep their width */
	}

	.dhud-unit {
		margin-left: 3px;
		font-size: 11px;
		font-weight: 700;
	}

	.dhud-label {
		margin-top: 3px;
		overflow: hidden;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ag-on-dark-2); /* going to the start */
	}

	.dhud--ontrail .dhud-label,
	.dhud--arriving .dhud-label {
		color: var(--ag-green-on-navy);
	}
</style>
