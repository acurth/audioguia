<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import { initOfflineStore, mergeDownloadState } from '$lib/stores/offline';
	import '../app.css';

	let { children } = $props();

	const ogTitle = 'Audioguía Natural — Senderos para escuchar';
	const ogDescription =
		'Una audioguía accesible para recorrer senderos naturales a través del sonido. Pensada para personas ciegas, abierta a todo público.';
	const ogUrl = base ? `${base}/` : '/';
	const ogImage = `${base}/og/audioguia-natural-og.png`;
	const logoSrc = `${base}/branding/audioguia-natural-cropped.png`;

	onMount(() => {
		initOfflineStore();
		if ('serviceWorker' in navigator) {
			const swUrl = `${base}/service-worker.js`;
			const handleMessage = (event: MessageEvent) => {
				const data = event.data;
				if (!data) return;
				if (data.type === 'tour-downloaded') {
					mergeDownloadState(data.id as string, { status: 'downloaded' });
				}
				if (data.type === 'tour-deleted') {
					mergeDownloadState(data.id as string, { status: 'idle' });
				}
			};

			navigator.serviceWorker.addEventListener('message', handleMessage);

			navigator.serviceWorker
				.register(swUrl, { scope: `${base}/`, type: 'module' })
				.catch((err) => console.error('SW registration failed', err));

			return () => {
				navigator.serviceWorker.removeEventListener('message', handleMessage);
			};
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

<div class="app-shell">
	<header class="site-header">
		<a class="site-logo" href={`${base}/`} aria-label="Ir al inicio">
			<img src={logoSrc} alt="Audioguía Natural" class="site-logo-img" />
		</a>
		<nav class="site-nav" aria-label="Navegación principal">
			<a href={`${base}/`} aria-current={$page.url.pathname === `${base}/` ? 'page' : undefined}>
				Inicio
			</a>
			<a
				href={`${base}/cerca`}
				aria-current={$page.url.pathname.startsWith(`${base}/cerca`) ? 'page' : undefined}
			>
				Cerca
			</a>
			<a
				href={`${base}/offline`}
				aria-current={$page.url.pathname.startsWith(`${base}/offline`) ? 'page' : undefined}
			>
				Offline
			</a>
			<a
				href={`${base}/explorar`}
				aria-current={$page.url.pathname.startsWith(`${base}/explorar`) ? 'page' : undefined}
			>
				Explorar
			</a>
		</nav>
	</header>

	{@render children()}
</div>
