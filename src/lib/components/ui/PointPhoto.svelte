<script lang="ts" module>
	const FRAME = 9; // white border, per side
	const OVERHANG = 4; // how far the postcard passes the map, per side

	/**
	 * The size rule from the spec: the photo grows until it touches the side
	 * that limits it, and passes that side by 4 px each way. A portrait photo
	 * overhangs top and bottom, a landscape one overhangs left and right, and
	 * a photo with the same ratio as the hole covers it exactly. That
	 * overhang is what makes it read as something resting on the map rather
	 * than a piece cut out of it.
	 */
	export function postcardSize(boxW: number, boxH: number, ratio: number) {
		let height = boxH + 2 * OVERHANG;
		let width = Math.round((height - 2 * FRAME) * ratio) + 2 * FRAME;

		if (width > boxW + 2 * OVERHANG) {
			// The width is what limits it, not the height.
			width = boxW + 2 * OVERHANG;
			height = Math.round((width - 2 * FRAME) / ratio) + 2 * FRAME;
		}

		return { width, height };
	}
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	type Props = {
		src: string;
		/** Empty string when the point has no written description yet. */
		alt: string;
		/** Size of the map panel the postcard sits over. */
		boxWidth: number;
		boxHeight: number;
		onClose: () => void;
		onExpand: () => void;
	};

	let { src, alt, boxWidth, boxHeight, onClose, onExpand }: Props = $props();

	// Until the file has loaded we do not know its shape, so the postcard
	// takes the ratio of the hole and settles when the image arrives.
	let naturalRatio = $state<number | null>(null);

	const ratio = $derived(naturalRatio ?? (boxHeight > 0 ? boxWidth / boxHeight : 1));
	const size = $derived(postcardSize(boxWidth, boxHeight, ratio));

	function handleLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			naturalRatio = img.naturalWidth / img.naturalHeight;
		}
	}
</script>

<!-- The map goes under a veil so the photo reads as a popup over it. -->
<div class="pp-veil" aria-hidden="true"></div>

<div class="pp-card" style={`width:${size.width}px; height:${size.height}px;`}>
	<button type="button" class="pp-image" onclick={onExpand} aria-label="Ampliar la foto del punto">
		<img {src} {alt} onload={handleLoad} />
	</button>

	<button type="button" class="pp-close" onclick={onClose} aria-label="Cerrar la foto del punto">
		<Icon name="x" size={21} stroke={2.6} />
	</button>
</div>

<style>
	.pp-veil {
		position: absolute;
		inset: 0;
		background: rgba(11, 32, 51, 0.58);
		border-radius: var(--ag-r-lg);
	}

	.pp-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		box-sizing: border-box;
	}

	.pp-image {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		background: var(--ag-navy);
		border: 9px solid #ffffff;
		border-radius: 2px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
		box-sizing: border-box;
		cursor: pointer;
	}

	.pp-image img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* The close control is an X because it closes the photo and nothing else.
	   The button on the point card stays a photo icon: an X there would read
	   as closing the point or the narration. */
	.pp-close {
		position: absolute;
		top: -15px;
		inset-inline-end: -15px;
		width: var(--ag-target);
		height: var(--ag-target);
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: none;
		border-radius: 50%;
		box-shadow: 0 3px 12px rgba(0, 0, 0, 0.55);
		color: var(--ag-navy);
		cursor: pointer;
	}

	.pp-close:hover {
		background: var(--ag-green-soft);
	}
</style>
