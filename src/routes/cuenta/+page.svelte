<script lang="ts">
	import { base } from '$app/paths';
	import TopBar from '$lib/components/ui/TopBar.svelte';
	import { APP_VERSION } from '$lib/config/version';

	const appBase = base;
</script>

<TopBar title="Cuenta" />

<div class="page">
	<main id="main" class="content ag-main">
		<!-- The heading lives in the top bar, beside the isologo. -->
		<p class="hero-subtitle">Escuchar recorridos no necesita cuenta. Estás como invitado.</p>

		<nav class="cuenta-links" aria-label="Ajustes">
			<a href={`${appBase}/offline`}>Descargas y espacio</a>
			<a href={`${appBase}/sobre`}>Sobre la audioguía</a>
		</nav>

		<p class="about-version">audioguia.io · versión {APP_VERSION}</p>
	</main>
</div>

<style>
	/* Placeholder screen. The designed version — guest state, the editor
	   block and the settings list — arrives with the Cuenta phase. */
	.cuenta-links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
	}

	.cuenta-links a {
		display: flex;
		align-items: center;
		min-height: var(--ag-target);
		padding: 0 1rem;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-md);
		color: var(--ag-fg-1);
		font-weight: 600;
		text-decoration: none;
	}

	.cuenta-links a:hover {
		border-color: var(--ag-green);
	}
</style>
