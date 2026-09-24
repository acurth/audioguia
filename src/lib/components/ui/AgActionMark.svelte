<script lang="ts">
	import AgGlyph, { type AgGlyphName } from './AgGlyph.svelte';

	type Action = 'trail-start' | 'trail-stop' | 'audio-play' | 'audio-pause';
	type Size = 'sm' | 'md' | 'lg' | 'xl';
	type Skin = 'light' | 'green' | 'navy';
	type Props = { action: Action; size?: Size; skin?: Skin };

	let { action, size = 'md', skin = 'light' }: Props = $props();

	const combinations: Record<Action, [AgGlyphName, AgGlyphName]> = {
		'trail-start': ['caminante', 'play'],
		'trail-stop': ['caminante', 'stop'],
		'audio-play': ['onda', 'play'],
		'audio-pause': ['onda', 'pausa']
	};
	/**
	 * Width, height and glyph size. `xl` is 48 px tall against the 44 px of a
	 * standard touch target, so the play control stands a couple of pixels
	 * proud of the buttons beside it without becoming a different shape.
	 */
	const dimensions: Record<Size, [number, number, number]> = {
		sm: [52, 30, 16],
		md: [60, 34, 18],
		lg: [72, 40, 21],
		xl: [84, 48, 24]
	};

	const glyphs = $derived(combinations[action]);
	const metrics = $derived(dimensions[size]);
</script>

<span
	class="ag-action-mark ag-action-mark--{skin}"
	style:width="{metrics[0]}px"
	style:height="{metrics[1]}px"
	aria-hidden="true"
>
	<AgGlyph name={glyphs[0]} size={metrics[2]} />
	<AgGlyph name={glyphs[1]} size={metrics[2]} />
</span>

<style>
	.ag-action-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: none;
		box-sizing: border-box;
		border-radius: var(--ag-r-pill);
	}

	.ag-action-mark--light {
		background: var(--ag-page, #f5f8fa);
		border: 1px solid var(--ag-border, #dce4eb);
		color: var(--ag-green, #348e4e);
	}

	.ag-action-mark--green {
		background: var(--ag-green-soft, #e9f4ed);
		border: 1px solid var(--ag-green-line, #a9d6b8);
		color: var(--ag-green-ink, #2a7440);
	}

	.ag-action-mark--navy {
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}
</style>
