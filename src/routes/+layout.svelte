<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { getDevModeFromStorage, getTourRecords } from '$lib/data/tours';
	import { getTourViews } from '$lib/data/tourView';
	import { initOfflineStore, mergeDownloadState } from '$lib/stores/offline';
	import AppNav from '$lib/components/ui/AppNav.svelte';
	import MiniPlayer from '$lib/components/ui/MiniPlayer.svelte';
	import { sectionForRoute } from '$lib/nav';
	import { listOrigin } from '$lib/stores/listOrigin';
	import { resumeTour, stopTour, togglePlay, tourSession } from '$lib/stores/tourSession';
	import '../app.css';

	let { children } = $props();

	// The walk keeps running when the person leaves the tour screen, so every
	// other screen offers the mini player as the way back into it.
	let session = $state($tourSession);

	/**
	 * Put back a walk that a reload interrupted, here in the component body
	 * rather than in onMount. The layout initialises before any page does, so
	 * by the time the tour screen first renders the session is already right
	 * and it draws the correct view once instead of correcting itself.
	 *
	 * It lives in the layout, not on the tour screen, because the session is
	 * app-wide: this also brings the mini player back for someone who reloads
	 * on Inicio. `getDevModeFromStorage` reads the query string as well as
	 * sessionStorage, so a dev-only trail is found even before the block below
	 * moves the flag across.
	 */
	if (browser) resumeTour(getTourViews(getDevModeFromStorage()), base);

	const DEFAULT_SITE_ORIGIN = 'https://audioguia.io';
	const siteOrigin = (env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');
	/**
	 * Absolute URL for metadata. The path must be root-relative and must not
	 * carry the app base: with `paths.relative` the base resolves to '.' or
	 * '..', which turns into URLs like https://audioguia.io/./og/image.png.
	 * If the app is ever served from a subfolder, put the subfolder in
	 * PUBLIC_SITE_URL.
	 */
	const toAbsoluteUrl = (path: string) =>
		`${siteOrigin}${path.startsWith('/') ? path : `/${path}`}`;
	const toursForSeo = getTourRecords(true).map((tour) => ({
		...tour,
		name: tour.data.name ?? tour.slug
	}));
	const tourByKey = toursForSeo.reduce<Record<string, (typeof toursForSeo)[number]>>(
		(acc, tour) => {
			acc[tour.slug] = tour;
			acc[tour.id] = tour;
			return acc;
		},
		{}
	);

	const appBase = base;
	const canonicalPath = $derived($page.url.pathname || '/');
	const canonicalUrl = $derived(toAbsoluteUrl(canonicalPath));
	const ogUrl = $derived(canonicalUrl);
	const ogImage = $derived(toAbsoluteUrl('/og/audioguia-natural-og.png'));

	// Route id rather than pathname: it is the same string whether the app is
	// served from the domain root or from a subfolder.
	const routeId = $derived($page.route.id);
	const isHome = $derived(routeId === '/');
	const isOffline = $derived(routeId?.startsWith('/offline') ?? false);
	const isExplorar = $derived(routeId?.startsWith('/explorar') ?? false);
	const isSobre = $derived(routeId?.startsWith('/sobre') ?? false);
	const isCuenta = $derived(routeId?.startsWith('/cuenta') ?? false);
	const isDev = $derived(routeId?.startsWith('/dev') ?? false);
	const isTrack = $derived(Boolean($page.params.track));
	const isRecorrido = $derived(routeId === '/[track]/recorrido');
	const currentTrack = $derived($page.params.track);
	const currentTour = $derived(currentTrack ? tourByKey[currentTrack] : null);
	const currentTrackName = $derived(currentTour?.name ?? null);

	// Detalle is not a tab of its own, so it marks the list it was opened
	// from. Everywhere else the route decides.
	const navSection = $derived(isTrack && !isRecorrido ? $listOrigin : sectionForRoute(routeId));

	// The tour in progress gets its own inverted bar when that screen is
	// rebuilt, so it carries no tab bar here.
	const showChrome = $derived(!isRecorrido);
	const showMiniPlayer = $derived(showChrome && session.status === 'tracking' && !!session.slug);

	const metaTitle = $derived.by(() => {
		if (isRecorrido) return `En recorrido: ${currentTrackName ?? 'Sendero'} | Audioguía Natural`;
		if (isTrack) return `${currentTrackName ?? 'Recorrido'} | Audioguía Natural`;
		if (isExplorar) return 'Explorar Recorridos | Audioguía Natural';
		if (isOffline) return 'Recorridos Offline | Audioguía Natural';
		if (isCuenta) return 'Cuenta | Audioguía Natural';
		if (isSobre) return 'Sobre la audioguía | Audioguía Natural';
		return 'Audioguía Natural – Senderos para escuchar';
	});
	const metaDescription = $derived.by(() => {
		if (isTrack) {
			const own = currentTour?.data?.description;
			if (typeof own === 'string' && own.length > 0) return own;
			return `Recorrido guiado por audio: ${currentTrackName ?? 'Sendero'}. Escuchá puntos geolocalizados y usalo también sin conexión.`;
		}
		if (isExplorar) {
			return 'Explorá todos los recorridos disponibles de Audioguía Natural: senderos para escuchar en Bariloche.';
		}
		if (isOffline) {
			return 'Gestioná recorridos descargados para escuchar sin conexión y continuar la experiencia de audioguía en cualquier momento.';
		}
		if (isCuenta) {
			return 'Tu cuenta en Audioguía Natural: descargas, accesibilidad y ajustes de la aplicación.';
		}
		if (isSobre) {
			return 'Conocé el proyecto Audioguía Natural, una propuesta accesible de senderos para escuchar en Bariloche: cómo funciona, quiénes la hacen y cómo usarla sin conexión.';
		}
		return 'Una audioguía accesible para recorrer senderos a través del sonido en Bariloche.';
	});
	// Offline and Cuenta are app screens with nothing to rank for: they stay
	// out of the index but keep passing link equity.
	//
	// /dev/* has no route today — the motion preview was removed from the
	// build — but the guard stays so that adding one back cannot quietly put
	// an internal page into the index, which is exactly what happened before.
	const robotsContent = $derived(
		isOffline || isCuenta || isRecorrido || isDev ? 'noindex,follow' : 'index,follow'
	);
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
				logo: toAbsoluteUrl('/branding/icon-180.png')
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

		if (isTrack && !isRecorrido && currentTour) {
			const pointCount = Array.isArray(currentTour.data?.points)
				? currentTour.data.points.length
				: 0;
			graph.push({
				'@type': 'TouristTrip',
				name: currentTour.name,
				description: metaDescription,
				url: canonicalUrl,
				inLanguage: 'es-AR',
				touristType: 'Personas con discapacidad visual y público general',
				image: toAbsoluteUrl(`/media/tours/${currentTour.slug}/background.webp`),
				...(currentTour.data?.place
					? { location: { '@type': 'Place', name: currentTour.data.place } }
					: {}),
				...(pointCount ? { itinerary: { '@type': 'ItemList', numberOfItems: pointCount } } : {}),
				provider: { '@id': `${siteOrigin}#organization` }
			});
		}

		return JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': graph
		}).replace(/</g, '\\u003c');
	});

	onMount(() => {
		const stopSession = tourSession.subscribe((value) => {
			session = value;
		});

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
				stopSession();
				navigator.serviceWorker.removeEventListener('message', handleMessage);
			};
		}

		return stopSession;
	});
</script>

<svelte:head>
	<title>{metaTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta name="robots" content={robotsContent} />
	<meta name="theme-color" content="#102C44" />
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

<div class="ag-shell" class:has-chrome={showChrome} class:has-miniplayer={showMiniPlayer}>
	<!-- First focusable element of every page. Each screen marks its own
	     content with id="main". -->
	<a class="skip-link" href="#main">Saltar al contenido</a>

	<div class="ag-shell-main">
		{@render children()}
	</div>

	{#if showMiniPlayer}
		<MiniPlayer {session} onTogglePlay={togglePlay} onStop={stopTour} />
	{/if}

	{#if showChrome}
		<AppNav current={navSection} />
	{/if}
</div>

<style>
	.ag-shell {
		/* border-box, so the room reserved for the nav is inside the 100dvh
		   rather than added to it. Without it every screen is one nav bar
		   taller than the window and scrolls with nothing to show. */
		box-sizing: border-box;
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--ag-page);
	}

	/* The bar sits at the bottom in portrait and turns into a left rail in
	   landscape. Both insets come from tokens.css, and one of them is always
	   zero, so the shell needs no breakpoint of its own. */
	/* The margins that keep the app at --ag-app-max on a wide window. Both are
	   zero on a phone and on a tablet. */
	.ag-shell {
		padding-left: var(--ag-app-gutter);
		padding-right: var(--ag-app-gutter);
	}

	.ag-shell.has-chrome {
		padding-bottom: var(--ag-nav-inset-block);
		padding-left: calc(var(--ag-app-gutter) + var(--ag-nav-inset-inline));
	}

	/* Room for the mini player, which sits just above the tab bar. */
	.ag-shell.has-miniplayer {
		padding-bottom: calc(var(--ag-nav-inset-block) + var(--ag-miniplayer-height));
	}

	.ag-shell-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
</style>
