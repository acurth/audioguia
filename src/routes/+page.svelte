<script lang="ts">
	import { base } from '$app/paths';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { SHOW_TIENDA, TIENDA_URL } from '$lib/config/features';
	import { getTourRecords } from '$lib/data/tours';
	import { LAST_UPDATE } from '$lib/version';

	// The panel footer, on tablet and desktop. Both figures come from the data
	// the app already ships, so they cannot drift from what Explorar lists.
	const tourCount = getTourRecords(false).length;
	const [updateYear, updateMonth, updateDay] = LAST_UPDATE.split('-');
	const updatedOn = `${updateDay}-${updateMonth}-${updateYear}`;
</script>

<div class="page-inicio">
	<main id="main">
		<!-- Three blocks in one reading order for every screen: the text, then
		     the photo. Portrait stacks them, landscape moves the photo into a
		     column of its own. The order is the DOM order, not CSS order, so
		     a screen reader hears what the screen shows. -->
		<section class="in-hero">
			<div class="in-hero-intro">
				<img
					class="in-logo"
					src={`${base}/branding/isologo-horizontal.png`}
					alt="audioguia.io"
					width="987"
					height="248"
				/>
				<h1>Senderos para escuchar</h1>
				<p>
					Una audioguía accesible para recorrer senderos a través del sonido. Los relatos se activan
					solos a medida que caminás. Los senderos se caminan acompañados: la app guía con imágenes
					a quien acompaña, y el relato y las señales sonoras acompañan a quienes escuchan.
					<a class="in-how" href={`${base}/sobre`}>
						Más información
						<Icon name="chevron-right" size={16} />
					</a>
				</p>
			</div>

			<div class="in-hero-photo">
				<img
					src={`${base}/media/home/intro-pasarela.jpg`}
					alt="Dos personas caminando por una pasarela de madera en el bosque, una de ellas con bastón blanco."
					width="665"
					height="1182"
				/>
			</div>
		</section>

		<!-- One green card with one control in it. The search field that used to
		     sit above this link was answering a question nobody has with three
		     trails: everything the app offers fits on one screen of Explorar.
		     It comes back when the catalogue is large enough to need it. The
		     height it was taking went to the photo. -->
		<section class="in-cta">
			<div class="in-cta-card">
				<a class="in-cta-link" href={`${base}/explorar`}>
					Explorar todos los recorridos
					<Icon name="chevron-right" size={16} />
				</a>
			</div>
		</section>

		<!-- Tablet and desktop only: the foot of the intro panel. Portrait has no
		     room for it and hides it. -->
		<footer class="in-foot">
			<p>{tourCount} recorridos disponibles en Bariloche</p>
			<p>Contenidos actualizados el {updatedOn}</p>
		</footer>

		{#if SHOW_TIENDA}
			<section class="in-tienda" aria-labelledby="in-tienda-title">
				<h2 id="in-tienda-title" class="sr-only">Tienda</h2>
				<Eyebrow label="Tienda" />
				<div class="in-tienda-card">
					<img
						src={`${base}/media/home/tienda.jpg`}
						alt="Gorra, taza, remera y birome con el logo de audioguia.io."
						width="1200"
						height="800"
					/>
					<div class="in-tienda-body">
						<p class="in-tienda-title">Gorras, remeras, tazas y biromes</p>
						<p class="in-tienda-text">Con el logo de audioguia.io.</p>
						<a class="in-tienda-cta" href={TIENDA_URL}>
							Ver la tienda
							<Icon name="chevron-right" size={15} />
						</a>
					</div>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.page-inicio {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--ag-surface);
	}

	/* Portrait is a column that fills the screen, so the photo can take
	   whatever height is left once the text and the green card have theirs.
	   That is what keeps the card above the fold without scrolling. */
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Portrait opens with 55 px of air above the isologo. It is the same
	   measure on every portrait screen that leads with the big logo.
	   The second row is the photo, and it takes every pixel the text, the
	   green card and the tab bar do not, with 110 px as the floor.
	   It used to be a subtraction against a hard-coded 522 px for "the text
	   and the card". That number was an estimate, and being an estimate it was
	   too generous: on a tall screen the difference was left over as a white
	   band under the green card. Letting the row grow removes the estimate,
	   and with it the band, on every screen size at once.
	   The photo is a portrait frame, 665 by 1182, so every pixel of height it
	   gains is a pixel it does not have to crop away.
	   Note for whoever turns SHOW_TIENDA on: this row takes the whole leftover,
	   so a third block under the green card would land below the fold with
	   nothing to scroll. Give main an overflow and cap this row again. */
	.in-hero {
		flex: 1;
		display: grid;
		grid-template-rows: auto minmax(110px, 1fr);
		gap: 12px;
		min-height: 0;
		padding: var(--ag-top-logo) var(--ag-side) 0;
	}

	.in-logo {
		width: 252px;
		height: 63px;
		max-width: 100%;
		display: block;
		margin: 0 auto 14px;
		object-fit: contain;
	}

	.in-hero h1 {
		margin: 0 0 8px;
		font-size: 26px;
		line-height: 1.15;
		font-weight: 800;
		letter-spacing: -0.015em;
		text-align: center;
		color: var(--ag-fg-1);
	}

	.in-hero p {
		margin: 0;
		font-size: 15px;
		line-height: 1.55;
		text-align: center;
		color: var(--ag-fg-2);
	}

	/* The photo is absolutely placed inside its own box so that it never
	   contributes to sizing: the box is the grid area, and in landscape that
	   area is measured from the text column beside it. Otherwise the photo's
	   own height pushes the rows apart and opens a gap under the text. */
	.in-hero-photo {
		position: relative;
		min-height: 0;
	}

	/* The crop is set from the top of the frame on purpose: the band that is
	   kept has to hold both walkers' heads, whatever height the photo ends
	   up with. */
	.in-hero-photo img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		object-position: 50% 28%;
		border-radius: 12px;
	}

	/* The link rides at the end of the paragraph rather than sitting in a
	   block of its own, which used to cost about 56 px of height on a phone.
	   A link inside a sentence is the one case where the 44 px target does
	   not apply, so it keeps the text's own size. */
	.in-how {
		white-space: nowrap;
		color: var(--ag-green-ink);
		font-weight: 700;
		text-decoration: none;
	}

	/* Icon draws its svg as a block, which would push the chevron onto a line
	   of its own at the end of the paragraph. */
	.in-how :global(svg) {
		display: inline-block;
		vertical-align: -3px;
	}

	.in-how:hover {
		text-decoration: underline;
	}

	/* 4 px, not the 24 px between blocks: "Cómo funciona" is a 44 px target,
	   so it already carries about 12 px of its own air above and below the
	   words. 4 px here makes the space under the link read the same as the
	   space over it. The 10 px at the bottom keeps the green card off the
	   tab bar. */
	.in-cta {
		flex: none;
		padding: 4px var(--ag-side) 10px;
	}

	.in-foot {
		display: none;
	}

	.in-cta-card {
		padding: 16px;
		background: var(--ag-green-ink);
		border-radius: 12px;
	}

	/* White, because the link sits on the green card. */
	.in-cta :global(a:focus-visible) {
		outline-color: #ffffff;
	}

	.in-cta-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 52px;
		padding: 14px;
		border: 1.5px solid rgba(255, 255, 255, 0.5);
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
		box-sizing: border-box;
	}

	.in-cta-link:hover {
		border-color: #ffffff;
		color: #ffffff;
	}

	.in-tienda {
		padding: var(--ag-section) var(--ag-side);
	}

	.in-tienda-card {
		margin-top: var(--ag-eyebrow-gap);
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.in-tienda-card img {
		width: 100%;
		height: 172px;
		display: block;
		object-fit: cover;
	}

	.in-tienda-body {
		padding: 14px 16px 16px;
	}

	.in-tienda-title {
		margin: 0 0 5px;
		font-size: 15px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.in-tienda-text {
		margin: 0 0 10px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	.in-tienda-cta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--ag-target);
		color: var(--ag-green-ink);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
	}

	/* Landscape and tablet: the three-panel layout from the tablet mockup
	   (audioguia-rediseno/tableta-inicio). Left to right: the 92 px rail, which
	   the shell already reserves; a fixed 420 px intro panel on the page grey
	   with a hairline down its right edge; and the photo, full bleed, taking
	   the rest of the width and the whole height.

	   The panel's background is drawn by main::before rather than by a wrapper
	   element, so the markup keeps one reading order for every screen: text,
	   photo, search card. */
	@media (min-width: 600px) and (orientation: landscape) {
		.page-inicio {
			background: var(--ag-surface);
		}

		main {
			display: grid;
			grid-template-columns: 420px minmax(0, 1fr);
			/* intro, search card, the space that pushes the foot down, foot */
			grid-template-rows: auto auto 1fr auto;
			height: 100%;
			box-sizing: border-box;
			padding: 0;
		}

		main::before {
			content: '';
			grid-column: 1;
			grid-row: 1 / -1;
			background: var(--ag-page);
			border-right: 1px solid var(--ag-border);
		}

		.in-hero {
			flex: none;
			display: contents;
		}

		.in-hero-intro {
			grid-column: 1;
			grid-row: 1;
			padding: 32px 24px 0;
		}

		.in-cta {
			grid-column: 1;
			grid-row: 2;
			align-self: start;
			padding: 24px 24px 0;
		}

		.in-foot {
			display: block;
			grid-column: 1;
			grid-row: 4;
			margin: 0 24px;
			padding: 14px 0 32px;
			border-top: 1px solid var(--ag-border);
		}

		/* The mockup prints this in #9AA8B4, which is 2.3:1 on the panel grey and
		   well under the 4.5:1 floor. --ag-muted is the lightest grey on the same
		   hue that clears it. */
		.in-foot p {
			margin: 0;
			font-size: 11.5px;
			line-height: 1.6;
			color: var(--ag-muted);
		}

		.in-hero-photo {
			grid-column: 2;
			grid-row: 1 / -1;
			align-self: stretch;
			min-height: 0;
		}

		/* Full bleed: no margin, no radius, and the crop set from the top so the
		   two walkers stay in frame whatever the panel's proportion. */
		.in-hero-photo img {
			object-position: 50% 35%;
			border-radius: 0;
		}

		.in-logo {
			width: 236px;
			height: 59px;
			margin: 0 0 16px;
		}

		.in-hero h1 {
			margin: 0 0 10px;
			font-size: 28px;
			text-align: start;
		}

		.in-hero p {
			font-size: 14px;
			line-height: 1.6;
			text-align: start;
		}

		.in-cta-card {
			padding: 18px;
		}

		.in-cta-link {
			padding: 13px;
		}

		.in-tienda {
			grid-column: 1;
			grid-row: 3;
			padding: 24px 24px 0;
		}
	}

	/* Landscape phone. Same three panels, one size down: the panel is narrower
	   because the screen is, everything above it loses a step, and the foot is
	   dropped because a 390 px screen has no room for it. */
	@media (min-width: 600px) and (max-height: 599px) and (orientation: landscape) {
		main {
			grid-template-columns: 360px minmax(0, 1fr);
		}

		.in-hero-intro {
			padding: 10px 16px 0;
		}

		.in-cta {
			padding: 8px 16px 10px;
		}

		.in-foot {
			display: none;
		}

		.in-logo {
			width: 160px;
			height: 40px;
			margin: 0 0 6px;
		}

		.in-hero h1 {
			margin: 0 0 4px;
			font-size: 19px;
		}

		.in-hero p {
			font-size: 13px;
			line-height: 1.4;
		}

		.in-cta-card {
			padding: 10px;
		}

		.in-cta-link {
			min-height: 40px;
			padding: 8px 14px;
			font-size: 14px;
		}
	}

	/* Tablet in portrait: phone structure, wider gutters, text capped so the
	   paragraphs do not stretch across the whole screen. */
	@media (min-width: 600px) and (orientation: portrait) {
		.in-hero h1,
		.in-hero p {
			max-width: 680px;
			margin-inline: auto;
		}

		.in-cta-card {
			max-width: 680px;
			margin: 0 auto;
		}
	}
</style>
