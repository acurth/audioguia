<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { getTourRecords } from '$lib/data/tours';
	import { initOfflineStore, mergeDownloadState } from '$lib/stores/offline';
	import '../app.css';

	let { children } = $props();

	const DEFAULT_SITE_ORIGIN = 'https://audioguia.io';
	const siteOrigin = (env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');
	const toAbsoluteUrl = (path: string) => `${siteOrigin}${path.startsWith('/') ? path : `/${path}`}`;
	const toursForSeo = getTourRecords(true).map((tour) => ({ ...tour, name: tour.data.name ?? tour.slug }));
	const tourNameByKey = toursForSeo.reduce<Record<string, string>>((acc, tour) => {
		acc[tour.slug] = tour.name;
		acc[tour.id] = tour.name;
		return acc;
	}, {});

	const appBase = base;
	const appBaseForAbsolute = appBase === '.' ? '' : appBase;
	const normalizedPath = $derived($page.url.pathname.replace(/\/$/, ''));
	const canonicalPath = $derived($page.url.pathname || '/');
	const canonicalUrl = $derived(toAbsoluteUrl(canonicalPath));
	const ogUrl = $derived(canonicalUrl);
	const ogImage = $derived(toAbsoluteUrl(`${appBaseForAbsolute}/og/audioguia-natural-og.png`));
	const logoSrc = $derived(`${appBase}/branding/audioguia-natural-cropped.png`);
	const isHome = $derived(normalizedPath === (appBase || ''));
	const isCerca = $derived(normalizedPath.startsWith(`${appBase}/cerca`));
	const isOffline = $derived(normalizedPath.startsWith(`${appBase}/offline`));
	const isExplorar = $derived(normalizedPath.startsWith(`${appBase}/explorar`));
	const isCreditos = $derived(normalizedPath.startsWith(`${appBase}/creditos`));
	const isTrack = $derived(Boolean($page.params.track));
	const currentTrack = $derived($page.params.track);
	const currentTrackName = $derived(currentTrack ? tourNameByKey[currentTrack] : null);
	const metaTitle = $derived.by(() => {
		if (isTrack) return `${currentTrackName ?? 'Recorrido'} | Audioguía Natural`;
		if (isCerca) return 'Recorridos Cerca Mío | Audioguía Natural';
		if (isExplorar) return 'Explorar Recorridos | Audioguía Natural';
		if (isOffline) return 'Recorridos Offline | Audioguía Natural';
		if (isCreditos) return 'Créditos | Audioguía Natural';
		return 'Audioguía Natural – Senderos para escuchar';
	});
	const metaDescription = $derived.by(() => {
		if (isTrack) {
			return `Recorrido guiado por audio: ${currentTrackName ?? 'Sendero'}. Escuchá puntos geolocalizados y usalo también sin conexión.`;
		}
		if (isCerca) {
			return 'Descubrí recorridos cercanos para escuchar en Bariloche con una audioguía accesible y geolocalizada.';
		}
		if (isExplorar) {
			return 'Explorá todos los recorridos disponibles de Audioguía Natural: senderos para escuchar en Bariloche.';
		}
		if (isOffline) {
			return 'Gestioná recorridos descargados para escuchar sin conexión y continuar la experiencia de audioguía en cualquier momento.';
		}
		if (isCreditos) {
			return 'Conocé el proyecto Audioguía Natural, una propuesta accesible de senderos para escuchar en Bariloche.';
		}
		return 'Una audioguía accesible para recorrer senderos naturales a través del sonido en Bariloche.';
	});
	const robotsContent = $derived((isOffline ? 'noindex,follow' : 'index,follow'));
	const jsonLd = $derived.by(() => {
		const graph: Record<string, unknown>[] = [
			{
				'@type': 'WebSite',
				'@id': `${siteOrigin}#website`,
				url: siteOrigin,
				name: 'Audioguía Natural',
				inLanguage: 'es-AR',
				description: 'Audioguía accesible de senderos para escuchar en Bariloche.'
			},
			{
				'@type': 'Organization',
				'@id': `${siteOrigin}#organization`,
				name: 'Audioguía Natural',
				url: siteOrigin,
				logo: toAbsoluteUrl(`${appBaseForAbsolute}/branding/icon-180.png`)
			},
			{
				'@type': 'WebPage',
				'@id': `${canonicalUrl}#webpage`,
				url: canonicalUrl,
				name: metaTitle,
				description: metaDescription,
				inLanguage: 'es-AR',
				isPartOf: { '@id': `${siteOrigin}#website` }
			}
		];

		if (isTrack && currentTrackName) {
			graph.push({
				'@type': 'TouristTrip',
				name: currentTrackName,
				description: metaDescription,
				url: canonicalUrl,
				inLanguage: 'es-AR'
			});
		}

		return JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': graph
		}).replace(/</g, '\\u003c');
	});

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('dev') === '1') {
			sessionStorage.setItem('devMode', '1');
			params.delete('dev');
			const nextUrl = new URL(window.location.href);
			nextUrl.search = params.toString();
			window.history.replaceState({}, '', nextUrl);
		}

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
	<title>{metaTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta name="robots" content={robotsContent} />
	<link rel="canonical" href={canonicalUrl} />

	<link rel="icon" type="image/png" sizes="32x32" href={`${appBase}/branding/icon-32.png`} />
	<link rel="icon" type="image/png" sizes="16x16" href={`${appBase}/branding/icon-16.png`} />
	<link rel="apple-touch-icon" sizes="180x180" href={`${appBase}/branding/icon-180.png`} />
	<link rel="manifest" href={`${appBase}/manifest.webmanifest`} />

	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Audioguía Natural" />
	<meta property="og:locale" content="es_AR" />
	<meta property="og:url" content={ogUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={metaTitle} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
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
						class="nav-offline"
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
