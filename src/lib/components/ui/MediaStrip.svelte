<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { PointMedia } from '$lib/utils/tourMeta';

	/**
	 * A point's photos and short videos, one at a time. Used by the postcard
	 * over the map and by the full-screen viewer, which share the index so
	 * the viewer opens on the item the postcard was showing.
	 *
	 * With one item this is just that item: no dots, no arrows, no swipe.
	 * With more, a finger swipes (the track is a native scroll strip that
	 * snaps to each item), a mouse uses the arrows, and the arrows go round
	 * from the last item to the first. The dots say there is more than one.
	 *
	 * Videos play muted and loop, and only the one on screen plays: the
	 * point's narration is what the walker is listening to.
	 */
	type Props = {
		/** Full URLs, base path included. */
		items: PointMedia[];
		index?: number;
		/** Postcard crops to its frame; the viewer shows the whole thing. */
		fit?: 'cover' | 'contain';
		/** Screen-reader text for the first photo; the others are decorative. */
		alt?: string;
		/** Tapping an item. Leave out when a tap should do nothing. */
		onActivate?: () => void;
		activateLabel?: string;
		/** Width over height of the first item, once it has loaded. */
		onRatio?: (ratio: number) => void;
	};

	let {
		items,
		index = $bindable(0),
		fit = 'cover',
		alt = '',
		onActivate,
		activateLabel = 'Ampliar',
		onRatio
	}: Props = $props();

	let track = $state<HTMLDivElement | null>(null);
	let videos = $state<(HTMLVideoElement | null)[]>([]);

	const many = $derived(items.length > 1);
	const current = $derived(Math.min(Math.max(index, 0), Math.max(items.length - 1, 0)));

	function go(step: number) {
		const count = items.length;
		index = (((current + step) % count) + count) % count;
	}

	/** The finger moved the strip: follow it. */
	function handleScroll() {
		if (!track || track.clientWidth === 0) return;
		const seen = Math.round(track.scrollLeft / track.clientWidth);
		if (seen !== index && seen >= 0 && seen < items.length) index = seen;
	}

	// The index moved by an arrow, a key or the other view: move the strip.
	// The first run is instant so the viewer does not slide in from item 1.
	let placed = false;
	$effect(() => {
		const target = current;
		if (!track || track.clientWidth === 0) return;
		const left = target * track.clientWidth;
		if (Math.abs(track.scrollLeft - left) > 2) {
			track.scrollTo({ left, behavior: placed ? 'smooth' : 'instant' });
		}
		placed = true;
	});

	// Only the video on screen plays. Set in code, not only as attributes,
	// because iOS will only start a video by itself when it is muted.
	$effect(() => {
		const target = current;
		videos.forEach((video, i) => {
			if (!video) return;
			video.muted = true;
			if (i === target) void video.play().catch(() => {});
			else video.pause();
		});
	});

	function reportRatio(width: number, height: number, i: number) {
		if (i === 0 && width > 0 && height > 0) onRatio?.(width / height);
	}
</script>

<div
	class="ms"
	class:ms--contain={fit === 'contain'}
	role="group"
	aria-roledescription={many ? 'carrusel' : undefined}
	aria-label={many ? `${current + 1} de ${items.length}` : undefined}
>
	<div class="ms-track" class:ms-track--many={many} bind:this={track} onscroll={handleScroll}>
		{#each items as item, i (i)}
			<svelte:element
				this={onActivate ? 'button' : 'div'}
				type={onActivate ? 'button' : undefined}
				class="ms-slide"
				aria-label={onActivate ? activateLabel : undefined}
				aria-hidden={many && i !== current ? 'true' : undefined}
				tabindex={many && i !== current ? -1 : undefined}
				onclick={onActivate}
			>
				{#if item.kind === 'video'}
					<video
						bind:this={videos[i]}
						src={item.src}
						muted
						loop
						playsinline
						autoplay={i === current}
						preload="auto"
						disablepictureinpicture
						disableremoteplayback
						aria-hidden="true"
						onloadedmetadata={(e) =>
							reportRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight, i)}
					></video>
				{:else}
					<img
						src={item.src}
						alt={i === 0 ? alt : ''}
						draggable="false"
						onload={(e) => {
							const img = e.currentTarget as HTMLImageElement;
							reportRatio(img.naturalWidth, img.naturalHeight, i);
						}}
					/>
				{/if}
			</svelte:element>
		{/each}
	</div>

	{#if many}
		<button
			type="button"
			class="ms-arrow ms-arrow--prev"
			onclick={() => go(-1)}
			aria-label="Anterior"
		>
			<Icon name="chevron-left" size={22} stroke={2.6} />
		</button>
		<button
			type="button"
			class="ms-arrow ms-arrow--next"
			onclick={() => go(1)}
			aria-label="Siguiente"
		>
			<Icon name="chevron-right" size={22} stroke={2.6} />
		</button>

		<div class="ms-dots" aria-hidden="true">
			{#each items as item, i (i)}
				<span class="ms-dot" class:is-current={i === current} class:is-video={item.kind === 'video'}
				></span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ms {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.ms-track {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	/* A native scroll strip: the finger gets the real iOS feel, momentum and
	   all, and each swipe stops on exactly one item. */
	.ms-track--many {
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.ms-track--many::-webkit-scrollbar {
		display: none;
	}

	.ms-slide {
		flex: 0 0 100%;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		scroll-snap-align: center;
		scroll-snap-stop: always;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	button.ms-slide {
		cursor: pointer;
	}

	.ms-slide img,
	.ms-slide video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
		-webkit-user-select: none;
		pointer-events: none;
	}

	.ms--contain .ms-slide img,
	.ms--contain .ms-slide video {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: 4px;
	}

	/* Arrows only where there is a mouse. A finger swipes, and two circles
	   over a phone-sized photo would cover what it shows. */
	.ms-arrow {
		display: none;
	}

	@media (hover: hover) and (pointer: fine) {
		.ms-arrow {
			position: absolute;
			top: 50%;
			transform: translateY(-50%);
			width: 40px;
			height: 40px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(255, 255, 255, 0.92);
			border: none;
			border-radius: 50%;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
			color: var(--ag-navy);
			cursor: pointer;
		}

		.ms-arrow:hover {
			background: var(--ag-green-soft);
		}

		.ms-arrow--prev {
			left: 8px;
		}

		.ms-arrow--next {
			right: 8px;
		}
	}

	.ms-dots {
		position: absolute;
		left: 50%;
		bottom: 10px;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		background: rgba(11, 32, 51, 0.62);
		border-radius: 999px;
		pointer-events: none;
	}

	.ms-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.55);
		transition:
			width 0.2s ease,
			background 0.2s ease;
	}

	.ms-dot.is-current {
		width: 18px;
		border-radius: 999px;
		background: #ffffff;
	}

	/* A video's dot is a small play triangle, so the walker knows a moving
	   picture is coming before they reach it. */
	.ms-dot.is-video {
		width: 0;
		height: 0;
		border-radius: 0;
		background: transparent;
		border-top: 4.5px solid transparent;
		border-bottom: 4.5px solid transparent;
		border-left: 8px solid rgba(255, 255, 255, 0.55);
	}

	.ms-dot.is-video.is-current {
		border-left-color: #ffffff;
		border-left-width: 10px;
		border-top-width: 5.5px;
		border-bottom-width: 5.5px;
	}
</style>
