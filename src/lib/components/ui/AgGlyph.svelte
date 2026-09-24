<script lang="ts" module>
	/** The five action glyphs supplied in audioguia-iconos.zip. */
	export type AgGlyphName = 'caminante' | 'onda' | 'play' | 'stop' | 'pausa';

	const STROKE_GLYPHS = {
		caminante:
			'CIRCLE:13,4,2.2|M12.9 6.7 12.1 12.5 16 20.8|M12.1 12.5 8 20.6|m12.5 8.6 3.4 2.8|M12.4 8.4 9.3 10.9',
		onda: 'M4 11.9v0.2M8 8.5v7M12 5v14M16 8.5v7M20 11v2'
	} as const;

	const FILL_GLYPHS = {
		play: 'M8 5v14l11-7z',
		stop: 'RECT:6,6,12,12,2',
		pausa: 'RECT:6,5,4,14,1|RECT:14,5,4,14,1'
	} as const;
</script>

<script lang="ts">
	type Shape =
		| { kind: 'path'; d: string }
		| { kind: 'circle'; cx: number; cy: number; r: number }
		| { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

	type Props = {
		name: AgGlyphName;
		size?: number;
		class?: string;
	};

	let { name, size = 18, class: className = '' }: Props = $props();

	function parseShapes(source: string): Shape[] {
		return source.split('|').map((part) => {
			if (part.startsWith('CIRCLE:')) {
				const [cx, cy, r] = part.slice(7).split(',').map(Number);
				return { kind: 'circle', cx, cy, r } as const;
			}
			if (part.startsWith('RECT:')) {
				const [x, y, width, height, rx] = part.slice(5).split(',').map(Number);
				return { kind: 'rect', x, y, width, height, rx } as const;
			}
			return { kind: 'path', d: part } as const;
		});
	}

	const isFilled = $derived(name in FILL_GLYPHS);
	const shapes = $derived(
		parseShapes(
			isFilled
				? FILL_GLYPHS[name as keyof typeof FILL_GLYPHS]
				: STROKE_GLYPHS[name as keyof typeof STROKE_GLYPHS]
		)
	);
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={isFilled ? 'currentColor' : 'none'}
	stroke={isFilled ? 'none' : 'currentColor'}
	stroke-width={isFilled ? undefined : 2.4}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each shapes as shape, index (index)}
		{#if shape.kind === 'circle'}
			<circle cx={shape.cx} cy={shape.cy} r={shape.r}></circle>
		{:else if shape.kind === 'rect'}
			<rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx}></rect>
		{:else}
			<path d={shape.d}></path>
		{/if}
	{/each}
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
