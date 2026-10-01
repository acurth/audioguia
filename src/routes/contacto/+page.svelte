<script lang="ts">
	import { base } from '$app/paths';
	import ContactForm from '$lib/components/account/ContactForm.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
</script>

<!-- The same form opens inside Cuenta. This page stays for links from
     outside the app. -->
<div class="page-contacto">
	<!-- Contacto is reached from Cuenta, so its back button goes there. -->
	<a class="co-back" href={`${base}/cuenta`} aria-label="Volver a Cuenta">
		<Icon name="chevron-left" size={18} />
	</a>

	<main id="main" class="co-main">
		<h1>Contacto</h1>
		<p class="co-lede">
			Escribinos con dudas, sugerencias o si encontraste algo que no funciona bien.
		</p>

		<ContactForm />
	</main>
</div>

<style>
	.page-contacto {
		flex: 1;
		position: relative;
		background: var(--ag-surface);
	}

	.co-back {
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

	.co-back:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	.co-main {
		max-width: 560px;
		margin: 0 auto;
		padding: var(--ag-top-logo) var(--ag-side) var(--ag-section);
	}

	h1 {
		margin: 0 0 6px;
		font-size: 25px;
		font-weight: 800;
		letter-spacing: -0.015em;
		text-align: center;
		color: var(--ag-fg-1);
	}

	.co-lede {
		margin: 0 0 20px;
		font-size: 14.5px;
		line-height: 1.6;
		text-align: center;
		color: var(--ag-fg-2);
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.co-main {
			padding-top: 20px;
		}
	}
</style>
