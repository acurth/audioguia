<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { SHOW_TIENDA, TIENDA_URL } from '$lib/config/features';

	let query = $state('');

	function search(event: SubmitEvent) {
		event.preventDefault();
		const term = query.trim();
		void goto(term ? `${base}/explorar?q=${encodeURIComponent(term)}` : `${base}/explorar`);
	}
</script>

<div class="page-inicio">
	<main id="main">
		<!-- Three blocks, so portrait reads logo, title, first paragraph,
		     photo, second paragraph, and landscape moves the photo into a
		     column of its own without reordering anything. -->
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
					Una audioguía accesible para recorrer senderos naturales a través del sonido. Los relatos
					se activan solos a medida que caminás.
				</p>
			</div>

			<div class="in-hero-photo">
				<img
					src={`${base}/media/home/intro-pasarela.jpg`}
					alt="Dos personas caminando por una pasarela de madera en el bosque, una de ellas con bastón blanco."
					width="1600"
					height="1200"
				/>
			</div>

			<div class="in-hero-rest">
				<p>
					Los senderos se caminan acompañados: la app guía con imágenes a quien acompaña, y el
					relato y las señales sonoras acompañan a quienes escuchan.
				</p>
				<a class="in-how" href={`${base}/sobre`}>
					Cómo funciona
					<Icon name="chevron-right" size={16} />
				</a>
			</div>
		</section>

		<section class="in-search" aria-labelledby="in-search-title">
			<form role="search" onsubmit={search}>
				<label id="in-search-title" for="inicio-q">Buscá un recorrido</label>
				<div class="in-search-field">
					<span class="in-search-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
					<input
						id="inicio-q"
						type="search"
						bind:value={query}
						placeholder="Sendero, lugar o tema"
						autocomplete="off"
					/>
					<button type="submit" class="in-search-go">Buscar</button>
				</div>
				<a class="in-search-all" href={`${base}/explorar`}>
					Explorar todos los recorridos
					<Icon name="chevron-right" size={16} />
				</a>
			</form>
		</section>

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
		background: var(--ag-surface);
	}

	main {
		display: block;
	}

	/* Portrait opens with 55 px of air above the isologo. It is the same
	   measure on every portrait screen that leads with the big logo. */
	.in-hero {
		display: grid;
		gap: 12px;
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

	.in-hero-photo img {
		width: 100%;
		height: 340px;
		display: block;
		object-fit: cover;
		object-position: 50% 31%;
		border-radius: 12px;
	}

	.in-hero-rest {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.in-how {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--ag-target);
		color: var(--ag-green-ink);
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
	}

	.in-how:hover {
		text-decoration: underline;
	}

	.in-search {
		padding: var(--ag-section) var(--ag-side) 0;
	}

	.in-search form {
		padding: 16px;
		background: var(--ag-green-ink);
		border-radius: 12px;
	}

	/* A shade lighter than the mockup's #CFE8D8, which gave 4.41:1 on this
	   green. This one clears the 4.5:1 minimum. */
	.in-search label {
		display: block;
		margin-bottom: 10px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #d5ecdd;
	}

	.in-search-field {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
		padding: 0 6px 0 14px;
		min-height: 52px;
		background: var(--ag-surface);
		border-radius: var(--ag-r-sm);
	}

	.in-search-icon {
		display: flex;
		flex: none;
		color: var(--ag-green-ink);
	}

	.in-search-field input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 15px;
		color: var(--ag-fg-1);
	}

	/* The mockup has no submit control. Typing and pressing Enter is not
	   discoverable for everyone, and a search field without a button is hard
	   to use on a phone, so there is a real button. */
	.in-search-go {
		flex: none;
		min-height: 40px;
		padding: 0 14px;
		background: var(--ag-green-ink);
		border: none;
		border-radius: var(--ag-r-sm);
		color: #ffffff;
		font-family: inherit;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.in-search-go:hover {
		background: #1f5a31;
	}

	.in-search-all {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--ag-target);
		padding: 12px;
		border: 1.5px solid rgba(255, 255, 255, 0.5);
		border-radius: var(--ag-r-pill);
		color: #ffffff;
		font-size: 15px;
		font-weight: 700;
		text-decoration: none;
		box-sizing: border-box;
	}

	.in-search-all:hover {
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

	/* Landscape and tablet: text on the left, photo on the right, and the
	   text stops being centred because the column is narrow enough to read. */
	/* Landscape and tablet: the text column on the left, the photo on the
	   right spanning both text rows. */
	@media (min-width: 600px) and (orientation: landscape) {
		.in-hero {
			grid-template-columns: 1fr 1fr;
			/* The first row hugs the intro so the second paragraph follows it
			   directly, instead of being pushed down by the taller photo. */
			grid-template-rows: auto 1fr;
			align-items: start;
			gap: 10px 24px;
			padding: 20px var(--ag-side-land) 0;
		}

		.in-hero-intro {
			grid-column: 1;
			grid-row: 1;
		}

		.in-hero-rest {
			grid-column: 1;
			grid-row: 2;
			align-items: flex-start;
		}

		.in-hero-photo {
			grid-column: 2;
			grid-row: 1 / span 2;
		}

		.in-hero-photo img {
			height: 390px;
		}

		.in-logo {
			width: 212px;
			height: 53px;
			margin: 0 0 12px;
		}

		.in-hero h1 {
			font-size: 24px;
			text-align: start;
		}

		.in-hero p {
			font-size: 14px;
			text-align: start;
		}

		.in-search {
			padding: 16px var(--ag-side-land) 0;
			max-width: 620px;
		}

		.in-tienda {
			padding: var(--ag-section) var(--ag-side-land);
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

		.in-search form {
			max-width: 680px;
			margin: 0 auto;
		}
	}
</style>
