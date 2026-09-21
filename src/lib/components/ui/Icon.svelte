<script lang="ts" module>
	// The icon set from the redesign generators (gen_ag.py). Stroke icons are
	// drawn on a 24x24 grid with round caps; filled icons carry no stroke.
	export const STROKE_ICONS = {
		home: 'M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 21v-7h6v7',
		compass: 'CIRCLE:12,12,9|m15.5 8.5-2.2 5-5 2.2 2.2-5z',
		download: 'M12 3v12|m7 11 5 5 5-5|M5 21h14',
		account: 'CIRCLE:12,8,4|M4 21v-1a7 7 0 0 1 14 0v1',
		search: 'CIRCLE:11,11,7|m21 21-4.3-4.3',
		heart:
			'M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 12 5.5 4.5 4.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7Z',
		share: 'CIRCLE:18,5,3|CIRCLE:6,12,3|CIRCLE:18,19,3|m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5',
		clock: 'CIRCLE:12,12,9|M12 7v5l3 2',
		'chevron-left': 'm15 18-6-6 6-6',
		'chevron-right': 'm9 18 6-6-6-6',
		'chevron-down': 'm6 9 6 6 6-6',
		x: 'M18 6 6 18M6 6l12 12',
		filter: 'M4 6h16M7 12h10M10 18h4',
		list: 'M8 6h12M8 12h12M8 18h12M3.6 6h.01M3.6 12h.01M3.6 18h.01',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
		lock: 'RECT:4,10,16,10,2|M8 10V7a4 4 0 0 1 8 0v3',
		check: 'm5 13 4 4 10-10',
		'map-pin': 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z|CIRCLE:12,10,2.5',
		headphones:
			'M4 15v-3a8 8 0 0 1 16 0v3|M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2z|M20 15a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z',
		ruler: 'M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3',
		accessibility: 'CIRCLE:12,4.2,1.8|M4.5 8.2h15M12 8.2v5.3m0 0-3.2 6.8M12 13.5l3.2 6.8',
		crosshair: 'CIRCLE:12,12,6.5|M12 2v3M12 19v3M2 12h3M19 12h3',
		mountain: 'M3 19h18L14 6l-3.4 6-2-3z',
		plus: 'M12 5v14M5 12h14',
		expand: 'M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6',
		image:
			'RECT:3,4,18,16,2.5|CIRCLE:8.6,9.6,1.6|m4 17 4.6-4.6a1.6 1.6 0 0 1 2.3 0L15 16.5M14 15l1.7-1.7a1.6 1.6 0 0 1 2.3 0L20 15.5',
		mail: 'RECT:3,5,18,14,2.5|m3.6 6.8 7.3 5.4a2 2 0 0 0 2.2 0l7.3-5.4',
		info: 'CIRCLE:12,12,9|M12 11v5|M12 7.6h.01',
		alert: 'M12 3.5 22 20H2z|M12 10v4|M12 17.2h.01'
	} as const;

	export const FILL_ICONS = {
		play: 'M8 5v14l11-7z',
		pause: 'RECT:6,5,4,14,1|RECT:14,5,4,14,1',
		stop: 'RECT:6,6,12,12,2',
		'skip-back': 'M12.5 12 20 6.5v11zM3.5 12 11 6.5v11z',
		'skip-fwd': 'M11.5 12 4 6.5v11zM20.5 12 13 6.5v11z',
		more: 'CIRCLE:12,5,1.6|CIRCLE:12,12,1.6|CIRCLE:12,19,1.6'
	} as const;

	export type IconName = keyof typeof STROKE_ICONS | keyof typeof FILL_ICONS;
</script>

<script lang="ts">
	type Shape =
		| { kind: 'path'; d: string }
		| { kind: 'circle'; cx: number; cy: number; r: number }
		| { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

	type Props = {
		/** Icon key from STROKE_ICONS or FILL_ICONS. */
		name: IconName;
		/** Rendered square size in pixels. */
		size?: number;
		/** Stroke weight. The redesign uses 2.4 for the active nav item, 2 otherwise. */
		stroke?: number;
		/**
		 * Accessible name. Leave it out for decorative icons that sit next to a
		 * text label: the icon is then hidden from screen readers.
		 */
		label?: string;
		class?: string;
	};

	let { name, size = 24, stroke = 2, label, class: className = '' }: Props = $props();

	// The compact notation above keeps the icon table readable. Each entry is a
	// pipe-separated list of either an SVG path, CIRCLE:cx,cy,r or RECT:x,y,w,h,rx.
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

	const isFilled = $derived(name in FILL_ICONS);
	const shapes = $derived(
		parseShapes(
			isFilled
				? FILL_ICONS[name as keyof typeof FILL_ICONS]
				: STROKE_ICONS[name as keyof typeof STROKE_ICONS]
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
	stroke-width={isFilled ? undefined : stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
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
