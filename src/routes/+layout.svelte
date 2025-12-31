<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { initOfflineStore, mergeDownloadState } from '$lib/stores/offline';
	import '../app.css';

	let { children } = $props();

	const ogTitle = 'Audioguía Natural — Senderos para escuchar';
	const ogDescription =
		'Una audioguía accesible para recorrer senderos naturales a través del sonido. Pensada para personas ciegas, abierta a todo público.';

	const appBase = base;
	const normalizedPath = $derived($page.url.pathname.replace(/\/$/, ''));
	const ogUrl = $derived(appBase ? `${appBase}/` : '/');
	const ogImage = $derived(`${appBase}/og/audioguia-natural-og.png`);
	const logoSrc = $derived(`${appBase}/branding/audioguia-natural-cropped.png`);
	const isHome = $derived(normalizedPath === (appBase || ''));
	const isCerca = $derived(normalizedPath.startsWith(`${appBase}/cerca`));
	const isOffline = $derived(normalizedPath.startsWith(`${appBase}/offline`));
	const isExplorar = $derived(normalizedPath.startsWith(`${appBase}/explorar`));
	const isCreditos = $derived(normalizedPath.startsWith(`${appBase}/creditos`));
	const isTrack = $derived(Boolean($page.params.track));

	onMount(() => {
		initOfflineStore();
		if ('serviceWorker' in navigator) {
			const swUrl = `${appBase}/service-worker.js`;
			const handleMessage = (event: MessageEvent) => {
				const data = event.data;
				if (!data) return;
				if (data.type === 'tour-downloaded') {
					mergeDownloadState(data.id as string, {
						status: 'downloaded',
						cacheResult: data.result as { okCount: number; failCount: number; failedUrls: string[] }
					});
				}
				if (data.type === 'tour-deleted') {
					mergeDownloadState(data.id as string, { status: 'idle', cacheResult: undefined });
				}
			};

			navigator.serviceWorker.addEventListener('message', handleMessage);

			navigator.serviceWorker
				.register(swUrl, { scope: `${appBase}/`, type: 'module' })
				.catch((err) => console.error('SW registration failed', err));

			return () => {
				navigator.serviceWorker.removeEventListener('message', handleMessage);
			};
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href={`${appBase}/branding/icon-32.png`} />
	<link rel="icon" type="image/png" sizes="16x16" href={`${appBase}/branding/icon-16.png`} />
	<link rel="apple-touch-icon" sizes="180x180" href={`${appBase}/branding/icon-180.png`} />
	<link rel="manifest" href={`${appBase}/manifest.webmanifest`} />

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
	{#if !isTrack}
		<header class="site-header">
			<div class="site-header-inner">
				<a class="site-logo" href={`${appBase}/`} aria-label="Ir al inicio">
					<img src={logoSrc} alt="Audioguía Natural" class="site-logo-img" />
				</a>
				<nav class="site-nav" aria-label="Navegación principal">
					<a href={`${appBase}/`} aria-current={isHome ? 'page' : undefined}>
						Inicio
					</a>
					<a
						href={`${appBase}/cerca`}
						aria-current={isCerca ? 'page' : undefined}
					>
						Cerca mío
					</a>
					<a
						href={`${appBase}/offline`}
						aria-current={isOffline ? 'page' : undefined}
					>
						Offline
					</a>
					<a
						href={`${appBase}/explorar`}
						aria-current={isExplorar ? 'page' : undefined}
					>
						Explorar
					</a>
					<a
						href={`${appBase}/creditos`}
						aria-current={isCreditos ? 'page' : undefined}
					>
						Créditos
					</a>
				</nav>
			</div>
		</header>
	{/if}

	{@render children()}
</div>
