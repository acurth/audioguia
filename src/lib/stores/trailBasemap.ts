import { browser } from '$app/environment';

/**
 * Keeps the Mapbox terrain image on the device, inside what the licence allows.
 *
 * Mapbox Product Terms 2.8.1: "Customer may cache that Licensed Map Content on
 * an End User's device but caching is limited to thirty (30) days on the same
 * device making the Mapping API request... Customer shall not distribute
 * Licensed Map Content, including from a cache, by proxying, or by using a
 * screenshot or other static image instead of accessing Licensed Map Content
 * directly from the Mapping APIs."
 *
 * So: the device fetches from api.mapbox.com itself, we keep the answer for at
 * most thirty days, and nothing is ever bundled into the app or served from
 * our own host. A stale entry is thrown away rather than shown.
 *
 * This deliberately does not go through the service worker. The tour cache
 * rejects anything cross-origin (see `isCacheableUrl`), and the tour cache has
 * no expiry, which is exactly what this content may not have.
 */

const CACHE_NAME = 'audioguia-basemap-v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Our own header, so we know when the device fetched it. */
const FETCHED_AT_HEADER = 'x-ag-fetched-at';

const canCache = () => browser && typeof caches !== 'undefined';

function isFresh(response: Response, now: number): boolean {
	const stamp = Number(response.headers.get(FETCHED_AT_HEADER));
	if (!Number.isFinite(stamp) || stamp <= 0) return false;
	return now - stamp < MAX_AGE_MS;
}

/** Re-wraps the image with the timestamp the expiry check reads. */
async function stamp(response: Response): Promise<Response> {
	const blob = await response.blob();
	return new Response(blob, {
		headers: {
			'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
			[FETCHED_AT_HEADER]: String(Date.now())
		}
	});
}

/**
 * Drops every entry past thirty days. Called before each read, so an image
 * cannot outlive the licence even if the walker never opens that trail again.
 */
async function prune(cache: Cache, now: number): Promise<void> {
	const keys = await cache.keys();
	await Promise.all(
		keys.map(async (request) => {
			const hit = await cache.match(request);
			if (!hit || !isFresh(hit, now)) await cache.delete(request);
		})
	);
}

/**
 * Fetches the image and stores it. Used when the walker taps Descargar, while
 * they still have signal, so the terrain is there on the trail where they have
 * none. Failure is silent on purpose: no terrain is a smaller problem than a
 * download that reports an error over a decorative background.
 */
export async function warmBasemap(url: string | null): Promise<void> {
	if (!url || !canCache()) return;
	try {
		const cache = await caches.open(CACHE_NAME);
		const existing = await cache.match(url);
		if (existing && isFresh(existing, Date.now())) return;

		const response = await fetch(url, { cache: 'no-store', mode: 'cors' });
		if (!response.ok) return;
		await cache.put(url, await stamp(response));
	} catch (err) {
		console.warn('Basemap could not be stored', err);
	}
}

/**
 * The image as an object URL, or null when there is none to show. Caller owns
 * the URL and must revoke it.
 *
 * Reads the cache first so a walker with no signal still gets the terrain, and
 * only then goes to the network.
 */
export async function loadBasemap(url: string | null): Promise<string | null> {
	if (!url || !browser) return null;

	const now = Date.now();

	if (canCache()) {
		try {
			const cache = await caches.open(CACHE_NAME);
			await prune(cache, now);
			const hit = await cache.match(url);
			if (hit && isFresh(hit, now)) {
				return URL.createObjectURL(await hit.blob());
			}
		} catch (err) {
			console.warn('Basemap cache unreadable', err);
		}
	}

	try {
		const response = await fetch(url, { mode: 'cors' });
		if (!response.ok) return null;
		const stamped = await stamp(response);

		if (canCache()) {
			try {
				const cache = await caches.open(CACHE_NAME);
				await cache.put(url, stamped.clone());
			} catch (err) {
				console.warn('Basemap could not be stored', err);
			}
		}

		return URL.createObjectURL(await stamped.blob());
	} catch {
		// Offline with nothing cached. TrailMap falls back to the drawn map.
		return null;
	}
}

/** Frees an object URL handed out by `loadBasemap`. */
export function releaseBasemap(objectUrl: string | null): void {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
}
