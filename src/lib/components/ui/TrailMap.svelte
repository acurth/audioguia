<script lang="ts">
	import type { TourPoint } from '$lib/utils/tourMeta';

	/**
	 * The trail drawn from the coordinates in the tour JSON. There is no
	 * aerial photograph behind it: the mockup used a Google Maps capture that
	 * cannot be published, and the licensed IGN image is not ready. Every
	 * pixel here comes from the JSON, so it is publishable and it works with
	 * no signal.
	 */
	type Props = {
		points: TourPoint[];
		/** Ids whose narration already fired. */
		triggeredIds: string[];
		currentPointId: string | null;
		position: { lat: number; lng: number; accuracy: number } | null;
		/** Trail name, for the accessible summary. */
		tourName: string;
	};

	let { points, triggeredIds, currentPointId, position, tourName }: Props = $props();

	// Drawing surface, in the ratio the redesign specifies for the panel.
	const VIEW_W = 398;
	const VIEW_H = 300;
	const PADDING = 34;

	type Placed = { point: TourPoint; x: number; y: number; index: number };

	/**
	 * Equirectangular projection, fitted to the panel. Longitude is squeezed
	 * by cos(latitude) so the shape of the trail stays true, and both axes
	 * share one scale so it is never stretched. North is up.
	 */
	const projection = $derived.by(() => {
		if (points.length === 0) return null;
		const latRef = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
		const cos = Math.cos((latRef * Math.PI) / 180);

		const xs = points.map((p) => p.lng * cos);
		const ys = points.map((p) => -p.lat);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const spanX = Math.max(...xs) - minX || 1e-9;
		const spanY = Math.max(...ys) - minY || 1e-9;
		const scale = Math.min((VIEW_W - PADDING * 2) / spanX, (VIEW_H - PADDING * 2) / spanY);

		return {
			cos,
			minX,
			minY,
			scale,
			offsetX: (VIEW_W - spanX * scale) / 2,
			offsetY: (VIEW_H - spanY * scale) / 2
		};
	});

	function project(lat: number, lng: number) {
		if (!projection) return { x: 0, y: 0 };
		return {
			x: projection.offsetX + (lng * projection.cos - projection.minX) * projection.scale,
			y: projection.offsetY + (-lat - projection.minY) * projection.scale
		};
	}

	const placed = $derived.by<Placed[]>(() =>
		points.map((point, index) => ({ point, index, ...project(point.lat, point.lng) }))
	);

	/** The walker, through the same projection, so the dot lands correctly. */
	const gps = $derived(position ? project(position.lat, position.lng) : null);

	const currentIndex = $derived(placed.findIndex((p) => p.point.id === currentPointId));

	/**
	 * Which point names to print on the map. Ten labels fit; seventeen or
	 * eighteen do not, so the longer trails show the current point and its
	 * immediate neighbours, which is what the walker needs anyway.
	 */
	const labelled = $derived.by(() => {
		if (placed.length <= 10) return placed;
		if (currentIndex < 0) return placed.slice(0, 3);
		return placed.filter((p) => Math.abs(p.index - currentIndex) <= 1);
	});

	const polyline = $derived(placed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));

	/**
	 * Labels pushed apart so they do not sit on top of each other. Points
	 * cluster wherever the trail doubles back, and two labels in the same
	 * place are worse than none. Each side of the map is spaced separately,
	 * top to bottom, and the current point keeps its own position.
	 */
	const MIN_LABEL_GAP = 19;

	type LabelBox = { item: Placed; side: 'left' | 'right'; y: number };

	const labelBoxes = $derived.by<LabelBox[]>(() => {
		const boxes: LabelBox[] = labelled.map((item) => ({
			item,
			side: item.x < VIEW_W / 2 ? 'right' : 'left',
			y: item.y
		}));

		for (const side of ['right', 'left'] as const) {
			const column = boxes.filter((box) => box.side === side).sort((a, b) => a.y - b.y);
			for (let i = 1; i < column.length; i += 1) {
				const gap = column[i].y - column[i - 1].y;
				if (gap < MIN_LABEL_GAP) column[i].y = column[i - 1].y + MIN_LABEL_GAP;
			}
			// If the column ran off the bottom, slide the whole thing back up.
			const overflow = (column.at(-1)?.y ?? 0) - (VIEW_H - 10);
			if (overflow > 0) for (const box of column) box.y -= overflow;
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

<div class="tm">
	<svg
		viewBox="0 0 {VIEW_W} {VIEW_H}"
		role="img"
		aria-label={summary}
		preserveAspectRatio="xMidYMid meet"
	>
		<!-- The spec asks for points with no drawn path, because the aerial
		     photograph showed the trail. Without that photograph the points
		     would float, so the line is drawn faintly to hold them together
		     until the IGN image arrives. -->
		{#if placed.length > 1}
			<polyline
				points={polyline}
				fill="none"
				stroke="rgba(255,255,255,0.22)"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-dasharray="1 7"
			/>
		{/if}

		{#each placed as item (item.point.id)}
			{@const state = stateOf(item)}
			{#if state === 'current'}
				<circle cx={item.x} cy={item.y} r="16" fill="var(--ag-green-on-navy)" opacity="0.3" />
				<circle
					cx={item.x}
					cy={item.y}
					r="9"
					fill="#FFFFFF"
					stroke="var(--ag-green)"
					stroke-width="3.5"
				/>
			{:else if state === 'done'}
				<circle
					cx={item.x}
					cy={item.y}
					r="7"
					fill="#FFFFFF"
					stroke="var(--ag-navy)"
					stroke-width="2"
				/>
			{:else}
				<circle
					cx={item.x}
					cy={item.y}
					r="6"
					fill="#FFFFFF"
					opacity="0.55"
					stroke="var(--ag-navy)"
					stroke-width="1.5"
				/>
			{/if}
		{/each}

		{#if gps}
			<!-- Blue on purpose: on a green forest a green dot would read as
			     one more point of the trail. -->
			<circle cx={gps.x} cy={gps.y} r="26" fill="var(--ag-gps)" opacity="0.18" />
			<circle cx={gps.x} cy={gps.y} r="11" fill="#FFFFFF" />
			<circle cx={gps.x} cy={gps.y} r="7.5" fill="var(--ag-gps)" />
		{/if}
	</svg>

	<!-- Labels sit in HTML rather than SVG so they stay legible at any panel
	     size and can be truncated with ellipsis. -->
	{#each labelBoxes as box (box.item.point.id)}
		{@const state = stateOf(box.item)}
		{@const toTheRight = box.side === 'right'}
		<span
			class="tm-label tm-label--{state}"
			aria-hidden="true"
			style={`left:${((box.item.x + (toTheRight ? 12 : -12)) / VIEW_W) * 100}%; top:${(box.y / VIEW_H) * 100}%; transform: translate(${toTheRight ? '0' : '-100%'}, -50%);`}
		>
			<b>{box.item.point.id}</b>
			{box.item.point.name}
		</span>
	{/each}

	{#if points.length > 10}
		<p class="tm-note" aria-hidden="true">Mostramos el punto actual y sus vecinos</p>
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

	.tm svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.tm-label {
		position: absolute;
		max-width: 40%;
		padding: 2px 5px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}

	.tm-label--current {
		background: var(--ag-green-ink);
		color: #ffffff;
	}

	.tm-label--done {
		background: rgba(16, 44, 68, 0.84);
		color: #ffffff;
	}

	.tm-label--upcoming {
		background: rgba(16, 44, 68, 0.72);
		color: rgba(255, 255, 255, 0.92);
	}

	.tm-label b {
		color: var(--ag-green-on-navy);
	}

	.tm-label--current b {
		color: #ffffff;
	}

	.tm-note {
		position: absolute;
		left: 10px;
		bottom: 10px;
		margin: 0;
		padding: 2px 6px;
		background: rgba(11, 32, 51, 0.82);
		border-radius: 4px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.92);
	}
</style>
