<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * The photo filling the screen. A sign can be recognised at 200 px, a
	 * knot in a trunk cannot, so tapping the postcard opens this.
	 */
	type Props = {
		src: string;
		alt: string;
		title: string;
		onClose: () => void;
	};

	let { src, alt, title, onClose }: Props = $props();

	let dialog = $state<HTMLDivElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		closeButton?.focus();
	});

	/** Escape closes, and Tab stays inside: there is only one control. */
	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
		if (event.key === 'Tab') event.preventDefault();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="pv" bind:this={dialog} role="dialog" aria-modal="true" aria-label={`Foto de ${title}`}>
	<img {src} {alt} />

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

	.pv img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: 4px;
	}

	.pv-close {
		position: absolute;
		top: max(16px, env(safe-area-inset-top, 0px));
		inset-inline-end: 16px;
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
