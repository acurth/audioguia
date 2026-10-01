<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import MediaStrip from '$lib/components/ui/MediaStrip.svelte';
	import type { PointMedia } from '$lib/utils/tourMeta';

	/**
	 * The photo filling the screen. A sign can be recognised at 200 px, a
	 * knot in a trunk cannot, so tapping the postcard opens this. With more
	 * than one photo or video it opens on the one the postcard was showing.
	 */
	type Props = {
		items: PointMedia[];
		index: number;
		alt: string;
		title: string;
		onClose: () => void;
	};

	let { items, index = $bindable(0), alt, title, onClose }: Props = $props();

	let dialog = $state<HTMLDivElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		closeButton?.focus();
	});

	/** Escape closes, the arrow keys move, and Tab stays inside. */
	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
		if (items.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			const step = event.key === 'ArrowLeft' ? -1 : 1;
			index = (((index + step) % items.length) + items.length) % items.length;
		}
		if (event.key === 'Tab' && dialog) {
			const controls = Array.from(
				dialog.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])')
			).filter((el) => el.offsetParent !== null);
			const at = controls.indexOf(document.activeElement as HTMLElement);
			event.preventDefault();
			const next = (at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
			controls[next]?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="pv" bind:this={dialog} role="dialog" aria-modal="true" aria-label={`Foto de ${title}`}>
	<div class="pv-media">
		<MediaStrip {items} bind:index fit="contain" {alt} />
	</div>

	<button type="button" class="pv-close" bind:this={closeButton} onclick={onClose}>
		<Icon name="x" size={22} stroke={2.6} />
		<span class="sr-only">Cerrar la foto</span>
	</button>
</div>

<style>
	.pv {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(11, 32, 51, 0.96);
		box-sizing: border-box;
	}

	.pv-media {
		width: 100%;
		height: 100%;
	}

	.pv-close {
		position: absolute;
		top: max(16px, env(safe-area-inset-top, 0px));
		inset-inline-end: 16px;
		z-index: 1;
		width: var(--ag-target);
		height: var(--ag-target);
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: none;
		border-radius: 50%;
		color: var(--ag-navy);
		cursor: pointer;
	}

	.pv-close:hover {
		background: var(--ag-green-soft);
	}
</style>
