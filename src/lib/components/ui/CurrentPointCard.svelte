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
		/**
		 * Hide the button when the point has no photo, and when the walker
		 * has left the point behind: a control that opens the photo of a
		 * point they have walked past is just confusing.
		 */
		showPhotoButton?: boolean;
		/**
		 * On tablet the photo is already on screen, so the button does not
		 * open anything: it enlarges.
		 */
		photoAlwaysVisible?: boolean;
		onTogglePhoto?: () => void;
	};

	let {
		point,
		number,
		total,
		distance,
		photoOpen = false,
		showPhotoButton = false,
		photoAlwaysVisible = false,
		onTogglePhoto
	}: Props = $props();

	const photoButtonLabel = $derived(
		photoAlwaysVisible
			? 'Ampliar la foto del punto'
			: photoOpen
				? 'Cerrar la foto del punto'
				: 'Ver la foto del punto'
	);

	const photo = $derived(point.photos?.[0] ? `${base}/${point.photos[0]}` : null);
	const distanceText = $derived(
		distance != null && Number.isFinite(distance) ? ` · a ${Math.round(distance)} m` : ''
	);
</script>

<article class="cpc">
	{#if photo}
		<img class="cpc-photo" src={photo} alt="" width="56" height="56" />
	{:else}
		<span class="cpc-photo cpc-photo--empty" aria-hidden="true"></span>
	{/if}

	<div class="cpc-text">
		<p class="cpc-eyebrow">Punto {number} de {total}{distanceText}</p>
		<h2 class="cpc-title">{point.name}</h2>
	</div>

	{#if showPhotoButton}
		<!-- Always the photo icon, never an X: an X on this card would read
		     as closing the point or the narration, not the photo. When the
		     photo is open the button inverts, and aria-pressed says so. -->
		<button
			type="button"
			class="cpc-photo-button"
			class:is-open={photoOpen && !photoAlwaysVisible}
			aria-label={photoButtonLabel}
			aria-pressed={photoAlwaysVisible ? undefined : photoOpen}
			onclick={onTogglePhoto}
		>
			<Icon name={photoAlwaysVisible ? 'expand' : 'image'} size={20} stroke={photoOpen ? 2.2 : 2} />
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

	.cpc-photo {
		width: 56px;
		height: 56px;
		flex: none;
		border-radius: 8px;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.08);
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
		background: rgba(255, 255, 255, 0.14);
		border: none;
		border-radius: 50%;
		color: #ffffff;
		cursor: pointer;
	}

	.cpc-photo-button.is-open {
		background: #ffffff;
		color: var(--ag-navy);
	}

	.cpc-photo-button:hover {
		background: rgba(255, 255, 255, 0.26);
	}

	.cpc-photo-button.is-open:hover {
		background: var(--ag-green-soft);
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.cpc {
			padding: 9px 10px;
		}

		.cpc-photo {
			width: 48px;
			height: 48px;
		}
	}
</style>
