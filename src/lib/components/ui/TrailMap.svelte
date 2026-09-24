<script lang="ts">
	import MapAttribution from '$lib/components/ui/MapAttribution.svelte';
	import { loadBasemap, releaseBasemap } from '$lib/stores/trailBasemap';
	import {
		MAP_HEIGHT,
		MAP_WIDTH,
		getMapView,
		getStaticImageUrl,
		projectPoint
	} from '$lib/utils/mapboxStatic';
	import type { TourPoint } from '$lib/utils/tourMeta';

	/**
	 * The trail drawn from the coordinates in the tour JSON, over a Mapbox
	 * terrain image when there is one.
	 *
	 * The terrain is optional on purpose. Without a Mapbox token, offline with
	 * nothing cached, or thirty days after the last fetch, the image is simply
	 * absent and the map falls back to the drawn version on a dark green
	 * panel, which is what shipped before and still works with no signal. Only
	 * the colours change: white lines over dark green, dark lines over terrain.
	 */
	type Props = {
		points: TourPoint[];
		/** Ids whose narration already fired. */
		triggeredIds: string[];
		currentPointId: string | null;
		position: { lat: number; lng: number; accuracy: number } | null;
		/** Trail name, for the accessible summary. */
		tourName: string;
		/** Enables point navigation while a tour is running. */
		onSelectPoint?: (point: TourPoint) => void;
	};

	let { points, triggeredIds, currentPointId, position, tourName, onSelectPoint }: Props = $props();

	// Drawing surface, in the ratio the redesign specifies for the panel. These
	// come from mapboxStatic so the image we request is exactly this size.
	const VIEW_W = MAP_WIDTH;
	const VIEW_H = MAP_HEIGHT;

	type Placed = { point: TourPoint; x: number; y: number; index: number };

	/**
	 * Web Mercator, at the centre and zoom the Mapbox image was requested
	 * with. Using the same projection for both is what keeps a numbered marker
	 * on its own bend in the path rather than somewhere near it. North is up.
	 *
	 * It is also used when there is no image, so the drawn map does not jump
	 * the moment the terrain loads.
	 */
	const view = $derived(getMapView(points));

	function project(lat: number, lng: number) {
		if (!view) return { x: 0, y: 0 };
		return projectPoint(view, lat, lng);
	}

	/**
	 * The terrain image. `basemapSrc` stays null until one is actually in
	 * hand, so nothing on the panel depends on a request that may never come
	 * back.
	 */
	let basemapSrc = $state<string | null>(null);

	const basemapUrl = $derived(getStaticImageUrl(points));

	$effect(() => {
		const url = basemapUrl;
		let stale = false;
		let mine: string | null = null;

		loadBasemap(url).then((objectUrl) => {
			if (stale) {
				releaseBasemap(objectUrl);
				return;
			}
			mine = objectUrl;
			basemapSrc = objectUrl;
		});

		return () => {
			stale = true;
			basemapSrc = null;
			releaseBasemap(mine);
		};
	});

	/** Lines have to flip from white to dark once terrain is behind them. */
	const trailStroke = $derived(basemapSrc ? 'rgba(27,42,58,0.55)' : 'rgba(255,255,255,0.22)');
	const leaderStroke = $derived(basemapSrc ? 'rgba(27,42,58,0.5)' : 'rgba(255,255,255,0.42)');
	const anchorFill = $derived(basemapSrc ? '#1b2a3a' : '#FFFFFF');

	const placed = $derived.by<Placed[]>(() =>
		points.map((point, index) => ({ point, index, ...project(point.lat, point.lng) }))
	);

	/** The walker, through the same projection, so the dot lands correctly. */
	const gps = $derived(position ? project(position.lat, position.lng) : null);

	const polyline = $derived(placed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

	/**
	 * Put each numbered control beside its own coordinate: right, left, above
	 * or below. The shortest collision-free candidate wins, so leader lines
	 * stay minimal while dense clusters remain independently tappable.
	 */
	const MARKER_MARGIN = 18;
	const MARKER_CLEARANCE = 34;
	const MARKER_OFFSETS = [21, 29, 37, 45, 53, 61, 69, 77, 85];
	type MarkerSide = 'right' | 'left' | 'top' | 'bottom';
	type MarkerBox = { item: Placed; side: MarkerSide; x: number; y: number };

	const directionOrders: MarkerSide[][] = [
		['right', 'top', 'bottom', 'left'],
		['left', 'bottom', 'top', 'right'],
		['top', 'right', 'left', 'bottom'],
		['bottom', 'left', 'right', 'top']
	];

	function markerCandidate(item: Placed, side: MarkerSide, offset: number): MarkerBox {
		const dx = side === 'right' ? offset : side === 'left' ? -offset : 0;
		const dy = side === 'bottom' ? offset : side === 'top' ? -offset : 0;
		return { item, side, x: item.x + dx, y: item.y + dy };
	}

	const markerBoxes = $derived.by<MarkerBox[]>(() => {
		const boxes: MarkerBox[] = [];
		for (const item of placed) {
			const directions = directionOrders[item.index % directionOrders.length];
			const candidates = MARKER_OFFSETS.flatMap((offset) =>
				directions.map((side) => markerCandidate(item, side, offset))
			).filter(
				(candidate) =>
					candidate.x >= MARKER_MARGIN &&
					candidate.x <= VIEW_W - MARKER_MARGIN &&
					candidate.y >= MARKER_MARGIN &&
					candidate.y <= VIEW_H - MARKER_MARGIN
			);

			const clear = candidates.find(
				(candidate) =>
					boxes.every(
						(box) => Math.hypot(candidate.x - box.x, candidate.y - box.y) >= MARKER_CLEARANCE
					) &&
					placed.every(
						(other) =>
							other.point.id === item.point.id ||
							Math.hypot(candidate.x - other.x, candidate.y - other.y) >= MARKER_MARGIN
					)
			);

			if (clear) {
				boxes.push(clear);
				continue;
			}

			// Extremely dense clusters may have no perfect candidate. Choose the
			// position with the largest clearance, keeping the line short as the
			// tie-breaker.
			const fallback = candidates.sort((a, b) => {
				const clearance = (candidate: MarkerBox) =>
					Math.min(
						...boxes.map((box) => Math.hypot(candidate.x - box.x, candidate.y - box.y)),
						MARKER_CLEARANCE
					);
				const clearanceDifference = clearance(b) - clearance(a);
				if (clearanceDifference !== 0) return clearanceDifference;
				return Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y);
			})[0];

			if (fallback) boxes.push(fallback);
		}
		return boxes;
	});

	function stateOf(item: Placed): 'done' | 'current' | 'upcoming' {
		if (item.point.id === currentPointId) return 'current';
		return triggeredIds.includes(item.point.id) ? 'done' : 'upcoming';
	}

	/** One sentence describing the map for anyone who cannot see it. */
	const summary = $derived.by(() => {
		const heard = triggeredIds.length;
		const current = placed.find((p) => p.point.id === currentPointId)?.point.name;
		const parts = [
			`Mapa del recorrido ${tourName}, con ${points.length} puntos.`,
			`${heard} ${heard === 1 ? 'escuchado' : 'escuchados'}.`
		];
		if (current) parts.push(`Punto actual: ${current}.`);
		if (position) parts.push('Tu posición está marcada en azul.');
		return parts.join(' ');
	});
</script>

<div class="tm" class:tm--terrain={basemapSrc}>
	{#if basemapSrc}
		<!-- Decorative: everything it shows is already in the text summary on
		     the svg below, so a screen reader should skip it. -->
		<img class="tm-terrain" src={basemapSrc} alt="" aria-hidden="true" draggable="false" />
	{/if}

	<svg
		viewBox="0 0 {VIEW_W} {VIEW_H}"
		role="img"
		aria-label={summary}
		preserveAspectRatio="xMidYMid meet"
	>
		<!-- The spec asks for points with no drawn path, because the aerial
		     photograph showed the trail. The Mapbox terrain draws the real
		     path underneath, but only where OpenStreetMap has it mapped, so
		     the faint line stays to hold the points together either way. -->
		{#if placed.length > 1}
			<polyline
				points={polyline}
				fill="none"
				stroke={trailStroke}
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-dasharray="1 7"
			/>
		{/if}

		{#each markerBoxes as box (box.item.point.id)}
			<line
				x1={box.item.x}
				y1={box.item.y}
				x2={box.x}
				y2={box.y}
				stroke={leaderStroke}
				stroke-width="1"
				stroke-linecap="round"
			/>
			<circle cx={box.item.x} cy={box.item.y} r="2.5" fill={anchorFill} opacity="0.85" />
		{/each}

		{#if gps}
			<!-- Blue on purpose: on a green forest a green dot would read as
			     one more point of the trail. -->
			<circle cx={gps.x} cy={gps.y} r="26" fill="var(--ag-gps)" opacity="0.18" />
			<circle cx={gps.x} cy={gps.y} r="11" fill="#FFFFFF" />
			<circle cx={gps.x} cy={gps.y} r="7.5" fill="var(--ag-gps)" />
		{/if}
	</svg>

	<!-- Compact numbered markers leave the point title to the current-point
	     card below. During a live tour they are map navigation controls. -->
	{#each markerBoxes as box (box.item.point.id)}
		{@const state = stateOf(box.item)}
		<button
			type="button"
			class="tm-point tm-point--{state}"
			style={`left:${(box.x / VIEW_W) * 100}%; top:${(box.y / VIEW_H) * 100}%;`}
			aria-label={`Ir al punto ${box.item.point.id}: ${box.item.point.name}`}
			aria-pressed={state === 'current'}
			disabled={!onSelectPoint}
			onclick={() => onSelectPoint?.(box.item.point)}
		>
			{box.item.point.id}
		</button>
	{/each}

	<!-- Only when Mapbox content is actually on screen. Their credits have no
	     business sitting over a map we drew ourselves. -->
	{#if basemapSrc}
		<MapAttribution />
	{/if}
</div>

<style>
	.tm {
		position: relative;
		flex: none;
		border-radius: var(--ag-r-lg);
		overflow: hidden;
		background: #1b3a2c;
		aspect-ratio: 398 / 300;
	}

	/* The terrain is light, so the dark green panel behind it would show as a
	   rim while it loads. Matching the style's own land colour hides that. */
	.tm--terrain {
		background: #cfe3b4;
	}

	.tm svg {
		position: relative;
		z-index: 1;
		display: block;
		width: 100%;
		height: 100%;
	}

	.tm-terrain {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		/* The image is requested at exactly this aspect ratio, so cover only
		   ever trims rounding, never a point off the edge. */
		object-fit: cover;
		user-select: none;
	}

	.tm-point {
		position: absolute;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 2px solid var(--ag-navy);
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.38);
		color: var(--ag-navy);
		font-family: inherit;
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		transform: translate(-50%, -50%);
		cursor: pointer;
	}

	/* The visible disc stays compact while the pseudo-element supplies a
	   44 px tap area. It belongs to the button, so taps still activate it. */
	.tm-point::before {
		content: '';
		position: absolute;
		inset: -6px;
		border-radius: 50%;
	}

	.tm-point--done {
		border-color: #ffffff;
		background: var(--ag-navy);
		color: #ffffff;
	}

	.tm-point--current {
		border: 3px solid var(--ag-green-on-panel);
		background: #ffffff;
		box-shadow:
			0 0 0 5px rgba(123, 222, 148, 0.25),
			0 2px 7px rgba(0, 0, 0, 0.45);
		color: var(--ag-navy);
	}

	.tm-point:hover:not(:disabled) {
		border-color: var(--ag-green-on-panel);
		transform: translate(-50%, -50%) scale(1.08);
	}

	.tm-point:focus-visible {
		outline: 3px solid #ffffff;
		outline-offset: 3px;
	}

	.tm-point:disabled {
		cursor: default;
	}

	@media (min-width: 600px) and (max-height: 599px) and (orientation: landscape) {
		.tm-point {
			width: 24px;
			height: 24px;
			font-size: 9px;
		}
	}
</style>
