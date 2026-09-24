<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { TourPoint } from '$lib/utils/tourMeta';

	/**
	 * The point being narrated: thumbnail, position in the trail, distance and
	 * title. Identical at the three breakpoints.
	 */
	type Props = {
		point: TourPoint;
		/** 1-based position of this point in the trail. */
		number: number;
		total: number;
		/** Metres from the walker to the point, when the position is known. */
		distance: number | null;
		/** The photo is showing. Drives the pressed state of the button. */
		photoOpen?: boolean;
		/** Hide the button only when the current point has no photo. */
		showPhotoButton?: boolean;
		onTogglePhoto?: () => void;
	};

	let {
		point,
		number,
		total,
		distance,
		photoOpen = false,
		showPhotoButton = false,
		onTogglePhoto
	}: Props = $props();

	const photoButtonLabel = $derived(
		photoOpen ? 'Cerrar la foto del punto' : 'Ver la foto del punto'
	);

	const photo = $derived(point.photos?.[0] ? `${base}/${point.photos[0]}` : null);
	const distanceText = $derived(
		distance != null && Number.isFinite(distance) ? ` · a ${Math.round(distance)} m` : ''
	);
</script>

<article class="cpc">
	<!-- The number is the same token as the map markers, on purpose: it is what
	     ties this card to the marker the walker just reached or tapped. The
	     eyebrow underneath still reads "Punto 3 de 10", so the badge is
	     decorative and a screen reader should not hear the figure twice. -->
	<div class="cpc-figure">
		{#if photo}
			<img class="cpc-photo" src={photo} alt="" width="56" height="56" />
		{:else}
			<span class="cpc-photo cpc-photo--empty" aria-hidden="true"></span>
		{/if}
		<span class="cpc-number" aria-hidden="true">{number}</span>
	</div>

	<div class="cpc-text">
		<p class="cpc-eyebrow">Punto {number} de {total}{distanceText}</p>
		<h2 class="cpc-title">{point.name}</h2>
	</div>

	{#if showPhotoButton}
		<!-- Keep the photo glyph in both states. The pressed treatment, rather
		     than a different symbol, shows that the popup is open. -->
		<button
			type="button"
			class="cpc-photo-button"
			class:is-open={photoOpen}
			aria-label={photoButtonLabel}
			aria-pressed={photoOpen}
			onclick={onTogglePhoto}
		>
			<Icon name="image" size={20} stroke={photoOpen ? 2.4 : 2} />
		</button>
	{/if}
</article>

<style>
	.cpc {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--ag-navy-panel);
		border-radius: 12px;
		box-sizing: border-box;
	}

	.cpc-figure {
		position: relative;
		flex: none;
	}

	.cpc-photo {
		display: block;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.08);
	}

	/* Same disc as .tm-point on the map: white, navy ring, navy figure. It
	   overlaps the corner rather than sitting inside, so it reads as a marker
	   pinned to the photo and not as part of the photo. */
	.cpc-number {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		box-sizing: border-box;
		border: 2px solid var(--ag-navy);
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.38);
		color: var(--ag-navy);
		font-size: 13px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.cpc-text {
		flex: 1;
		min-width: 0;
	}

	.cpc-eyebrow {
		margin: 0 0 3px;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ag-green-on-panel);
	}

	.cpc-title {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		line-height: 1.2;
		color: #ffffff;
	}

	.cpc-photo-button {
		width: var(--ag-target);
		height: var(--ag-target);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: 2px solid transparent;
		border-radius: 50%;
		color: var(--ag-navy);
		cursor: pointer;
		box-sizing: border-box;
	}

	.cpc-photo-button.is-open {
		background: var(--ag-green-soft);
		border-color: var(--ag-green-line);
		color: var(--ag-green-ink);
	}

	.cpc-photo-button:hover {
		background: var(--ag-green-soft);
	}

	.cpc-photo-button.is-open:hover {
		border-color: var(--ag-green-on-panel);
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.cpc {
			padding: 9px 10px;
		}

		.cpc-photo {
			width: 48px;
			height: 48px;
		}

		/* The card padding drops to 9 px here, so the badge pulls in with it
		   to stay clear of the card edge. */
		.cpc-number {
			top: -6px;
			left: -6px;
			width: 26px;
			height: 26px;
			font-size: 11.5px;
		}
	}
</style>
