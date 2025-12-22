<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();

	const ogTitle = 'Audioguía Natural — Senderos para escuchar';
	const ogDescription =
		'Una audioguía accesible para recorrer senderos naturales a través del sonido. Pensada para personas ciegas, abierta a todo público.';
	const ogUrl = base ? `${base}/` : '/';
	const ogImage = `${base}/og/audioguia-natural-og.png`;

	onMount(() => {
		if ('serviceWorker' in navigator) {
			const swUrl = `${base}/service-worker.js`;

			navigator.serviceWorker
				.register(swUrl, { scope: `${base}/`, type: 'module' })
				.catch((err) => console.error('SW registration failed', err));
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="icon" type="image/png" sizes="32x32" href={`${base}/branding/icon-32.png`} />
	<link rel="icon" type="image/png" sizes="16x16" href={`${base}/branding/icon-16.png`} />
	<link rel="apple-touch-icon" sizes="180x180" href={`${base}/branding/icon-180.png`} />
	<link rel="manifest" href={`${base}/manifest.webmanifest`} />

	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={ogUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

{@render children()}
