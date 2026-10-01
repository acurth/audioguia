<script lang="ts">
	import { base } from '$app/paths';
	import SobreContent from '$lib/components/account/SobreContent.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
</script>

<!-- The same content opens inside Cuenta. This page stays for links from
     outside the app and for search engines. -->
<div class="page-sobre">
	<!-- Sobre is not a tab, so it carries a back button. -->
	<a class="so-back" href={`${base}/cuenta`} aria-label="Volver a Cuenta">
		<Icon name="chevron-left" size={18} />
	</a>

	<main id="main" class="so-main">
		<img
			class="so-logo"
			src={`${base}/branding/isologo-horizontal.png`}
			alt="audioguia.io"
			width="987"
			height="248"
		/>
		<h1>Senderos para escuchar</h1>
		<p class="so-lede">Una audioguía accesible para recorrer senderos a través del sonido.</p>

		<SobreContent />
	</main>
</div>

<style>
	.page-sobre {
		flex: 1;
		position: relative;
		background: var(--ag-surface);
	}

	.so-back {
		position: absolute;
		top: 16px;
		inset-inline-start: 16px;
		z-index: 2;
		width: var(--ag-target);
		height: var(--ag-target);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-1);
		text-decoration: none;
	}

	.so-back:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	.so-main {
		padding: var(--ag-top-logo) var(--ag-side) var(--ag-section);
	}

	.so-logo {
		width: 224px;
		height: 56px;
		max-width: 100%;
		display: block;
		margin: 0 auto 18px;
		object-fit: contain;
	}

	h1 {
		margin: 0 0 6px;
		font-size: 25px;
		font-weight: 800;
		letter-spacing: -0.015em;
		text-align: center;
		color: var(--ag-fg-1);
	}

	.so-lede {
		margin: 0 0 20px;
		font-size: 14.5px;
		line-height: 1.6;
		text-align: center;
		color: var(--ag-fg-2);
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.so-main {
			padding: 20px var(--ag-side-land);
		}

		.so-back {
			top: 14px;
			inset-inline-start: 14px;
		}

		.so-logo {
			margin-bottom: 12px;
		}

		h1 {
			font-size: 22px;
		}

		.so-lede {
			margin-bottom: 14px;
		}
	}

	/* Tablet in portrait: phone structure, text capped so it stays readable. */
	@media (min-width: 600px) and (orientation: portrait) {
		.so-main {
			max-width: 760px;
			margin-inline: auto;
		}
	}
</style>
