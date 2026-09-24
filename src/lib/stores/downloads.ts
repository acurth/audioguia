import { browser } from '$app/environment';
import { getOfflineFiles, type TourView } from '$lib/data/tourView';
import {
	downloadStateStore,
	mergeDownloadState,
	setDownloadState,
	type DownloadState
} from '$lib/stores/offline';
import { warmBasemap } from '$lib/stores/trailBasemap';
import { getStaticImageUrl } from '$lib/utils/mapboxStatic';

/**
 * One place for asking the service worker to download, delete or re-download a
 * tour, and for turning its progress messages into store updates and into
 * text a screen reader can follow. Explorar, Offline and Detalle all use this
 * instead of each keeping its own copy.
 */

const TOUR_CACHE_PREFIX = 'audioguia-tour-';
const ANNOUNCE_INTERVAL_MS = 2000;
const STALL_TIMEOUT_MS = 30000;

export function getProgressPercent(state?: DownloadState): number {
	if (!state) return 0;
	if (typeof state.progress === 'number') return state.progress;
	if (state.completedFiles && state.totalFiles) {
		return Math.round((state.completedFiles / state.totalFiles) * 100);
	}
	return 0;
}

/**
 * The file counter shown to people. The manifest counts the tour JSON as one
 * more file, which would make the total look one higher than the audios.
 */
export function getDisplayCounts(state?: DownloadState) {
	const total = Math.max((state?.totalFiles ?? 0) - 1, 0);
	const current = Math.min(state?.currentIndex ?? state?.completedFiles ?? 0, total);
	return { current, total };
}

export function isStalled(state: DownloadState | undefined, now: number): boolean {
	if (!state || state.status !== 'downloading' || !state.lastUpdate) return false;
	return now - state.lastUpdate > STALL_TIMEOUT_MS;
}

export function getStageLabel(stage?: string): string {
	if (stage === 'preparing') return 'Preparando…';
	if (stage === 'saving') return 'Guardando para uso offline…';
	if (stage === 'done') return 'Listo';
	if (stage === 'error') return 'Error en la descarga';
	return 'Descargando audios…';
}

/**
 * What the screen reader should say next, or the previous text when nothing
 * worth interrupting has happened. Progress is announced at most every two
 * seconds, so the live region does not talk over everything else.
 */
function nextAnnouncement(
	prev: DownloadState | undefined,
	next: DownloadState,
	label: string
): Pick<DownloadState, 'screenreaderText' | 'lastAnnouncedProgress' | 'lastAnnouncedAt'> {
	const lastAnnouncedAt = prev?.lastAnnouncedAt ?? 0;
	const elapsed = Date.now() - lastAnnouncedAt;
	const movedOn =
		next.completedFiles !== prev?.completedFiles || next.currentIndex !== prev?.currentIndex;

	if (next.errorMessage) {
		return {
			screenreaderText: `${label}. ${next.errorMessage}`,
			lastAnnouncedProgress: next.completedFiles ?? prev?.lastAnnouncedProgress,
			lastAnnouncedAt: Date.now()
		};
	}

	if (next.stage === 'done') {
		return {
			screenreaderText: `${label}. Descarga completa.`,
			lastAnnouncedProgress: 100,
			lastAnnouncedAt: Date.now()
		};
	}

	if (prev?.stage !== next.stage && next.stage !== 'downloading') {
		return {
			screenreaderText: `${label}. ${getStageLabel(next.stage)}`,
			lastAnnouncedProgress: next.completedFiles ?? prev?.lastAnnouncedProgress,
			lastAnnouncedAt: Date.now()
		};
	}

	if (movedOn && elapsed >= ANNOUNCE_INTERVAL_MS) {
		const { current, total } = getDisplayCounts(next);
		return {
			screenreaderText: `${label}. Descargando ${current} de ${total}.`,
			lastAnnouncedProgress: next.completedFiles ?? prev?.lastAnnouncedProgress,
			lastAnnouncedAt: Date.now()
		};
	}

	return {
		screenreaderText: prev?.screenreaderText,
		lastAnnouncedProgress: prev?.lastAnnouncedProgress,
		lastAnnouncedAt: prev?.lastAnnouncedAt
	};
}

/**
 * Why this device cannot download, or null when it can. Downloading needs the
 * service worker, and a service worker needs a secure context: https, or
 * localhost. A phone opening the dev server by its LAN address gets plain
 * http, where the browser does not expose one at all. Without this check the
 * Descargar button returns in silence and reads as broken.
 */
export function offlineUnavailableReason(): string | null {
	if (!browser) return null;
	if ('serviceWorker' in navigator) return null;
	if (!window.isSecureContext) {
		return 'Para descargar hay que abrir la app en una dirección https. En http el navegador no habilita el guardado sin conexión.';
	}
	return 'Este navegador no puede guardar recorridos para escuchar sin conexión.';
}

export async function requestDownload(tour: TourView): Promise<void> {
	if (!browser) return;

	const unavailable = offlineUnavailableReason();
	if (unavailable) {
		setDownloadState(tour.id, {
			status: 'error',
			bytes: tour.sizeBytes,
			stage: 'error',
			errorMessage: unavailable
		});
		return;
	}

	const files = getOfflineFiles(tour);
	if (files.length === 0) {
		setDownloadState(tour.id, {
			status: 'error',
			bytes: tour.sizeBytes,
			stage: 'error',
			errorMessage: 'Este recorrido todavía no tiene archivos para descargar.'
		});
		return;
	}

	setDownloadState(tour.id, {
		status: 'downloading',
		bytes: tour.sizeBytes,
		downloadedBytes: 0,
		progress: 0,
		stage: 'preparing',
		completedFiles: 0,
		totalFiles: files.length,
		currentIndex: 0,
		lastUpdate: Date.now()
	});

	/**
	 * Fetch the terrain image now, while there is still signal. It does not go
	 * through the service worker: the tour cache refuses cross-origin URLs, and
	 * Mapbox content may not be kept past thirty days, which that cache has no
	 * way to enforce. See `trailBasemap.ts`.
	 *
	 * Deliberately not awaited. It is a background for a map that works
	 * without it, so it must never hold up or fail the audio download.
	 */
	void warmBasemap(getStaticImageUrl(tour.points));

	const registration = await navigator.serviceWorker.ready;
	registration.active?.postMessage({
		type: 'download-tour',
		payload: { id: tour.id, slug: tour.slug, files, json: JSON.stringify(tour.raw) }
	});
}

export async function deleteDownload(tour: TourView): Promise<void> {
	if (!browser || !('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.ready;
	registration.active?.postMessage({ type: 'delete-tour', id: tour.id });
	setDownloadState(tour.id, { status: 'idle', bytes: tour.sizeBytes });
}

/** Clears a half-finished cache, optionally starting the download again. */
export async function resetDownload(tour: TourView, restart = false): Promise<void> {
	if (!browser || !('caches' in window)) return;
	await caches.delete(`${TOUR_CACHE_PREFIX}${tour.id}`);
	setDownloadState(tour.id, { status: 'idle', bytes: tour.sizeBytes });
	if (restart) await requestDownload(tour);
}

/**
 * Subscribes to the service worker progress messages. Returns the unsubscribe
 * function, so a component can hand it straight back from onMount.
 */
export function listenToDownloadProgress(getTour: (id: string) => TourView | undefined) {
	if (!browser || !('serviceWorker' in navigator)) return () => undefined;

	let current: Record<string, DownloadState> = {};
	const unsubscribe = downloadStateStore.subscribe((state) => {
		current = state;
	});

	const handleMessage = (event: MessageEvent) => {
		const data = event.data;
		if (!data?.id) return;
		const tourId = data.id as string;
		const tour = getTour(tourId);
		const prev = current[tourId];

		if (data.type === 'tour-downloaded') {
			mergeDownloadState(tourId, {
				status: 'downloaded',
				bytes: tour?.sizeBytes,
				downloadedBytes: tour?.sizeBytes,
				progress: 100,
				stage: 'done',
				lastUpdate: Date.now(),
				screenreaderText: `${tour?.name ?? 'El recorrido'} quedó listo sin conexión.`,
				cacheResult: data.result
			});
			return;
		}

		if (data.type === 'tour-deleted') {
			setDownloadState(tourId, { status: 'idle', bytes: tour?.sizeBytes });
			return;
		}

		if (data.type === 'tour-progress') {
			const totalFiles =
				typeof data.total === 'number'
					? data.total
					: (tour?.offline?.files?.length ?? prev?.totalFiles ?? 0);
			const completedFiles =
				typeof data.completed === 'number' ? data.completed : (prev?.completedFiles ?? 0);
			const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
			const bytesTotal = tour?.sizeBytes;

			const next: DownloadState = {
				...(prev ?? { status: 'downloading' }),
				status: 'downloading',
				bytes: bytesTotal ?? prev?.bytes,
				downloadedBytes:
					bytesTotal && totalFiles > 0 ? Math.round((completedFiles / totalFiles) * bytesTotal) : 0,
				progress,
				stage: (data.stage as DownloadState['stage']) ?? 'downloading',
				completedFiles,
				totalFiles,
				currentIndex:
					typeof data.currentIndex === 'number' ? data.currentIndex : prev?.currentIndex,
				currentUrl: typeof data.currentUrl === 'string' ? data.currentUrl : prev?.currentUrl,
				lastUpdate: Date.now(),
				errorMessage: typeof data.error === 'string' ? data.error : undefined
			};

			mergeDownloadState(tourId, {
				...next,
				...nextAnnouncement(prev, next, `Descarga de ${tour?.name ?? 'recorrido'}`)
			});
		}
	};

	navigator.serviceWorker.addEventListener('message', handleMessage);

	return () => {
		navigator.serviceWorker.removeEventListener('message', handleMessage);
		unsubscribe();
	};
}

/**
 * A download whose cache vanished (the browser evicted it, or the worker died)
 * would otherwise sit at "downloading" for ever. This marks those as failed so
 * the card can offer a retry.
 */
export async function verifyDownloads(tours: TourView[]): Promise<void> {
	if (!browser || !('caches' in window)) return;

	let current: Record<string, DownloadState> = {};
	const unsubscribe = downloadStateStore.subscribe((state) => {
		current = state;
	});
	unsubscribe();

	await Promise.all(
		tours
			.filter((tour) => current[tour.id]?.status === 'downloading')
			.map(async (tour) => {
				try {
					const cache = await caches.open(`${TOUR_CACHE_PREFIX}${tour.id}`);
					const keys = await cache.keys();
					if (keys.length === 0) {
						mergeDownloadState(tour.id, {
							status: 'error',
							stage: 'error',
							errorMessage: 'Descarga detenida. Podés reintentar.',
							screenreaderText: `Descarga de ${tour.name}. Descarga detenida. Podés reintentar.`,
							lastUpdate: Date.now()
						});
					}
				} catch (err) {
					console.error('Failed to verify cache', err);
				}
			})
	);
}
