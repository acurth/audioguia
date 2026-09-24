import type { TourPoint } from '$lib/utils/tourMeta';

/**
 * The terrain image that sits behind the drawn trail, from the Mapbox Static
 * Images API.
 *
 * Two things drive the shape of this file.
 *
 * The first is alignment. The numbered markers are drawn by us, on top of an
 * image drawn by Mapbox, so both have to use the same projection or the
 * markers land in the wrong place. That is why we ask for an explicit centre
 * and zoom rather than a bounding box: with a bounding box Mapbox picks the
 * centre and zoom itself, and we would have to guess them back. Here we work
 * out both, send them, and reuse them for our own drawing. See `projectPoint`.
 *
 * The second is the licence. Mapbox Product Terms 2.8.1 lets us cache an image
 * on the walker's own device for thirty days, but only if that device fetched
 * it from the API itself. We may not ship the image inside the app or serve it
 * from our own server. `trailBasemap.ts` holds that side of it.
 */

const TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim();

/**
 * `outdoors-v12` rather than a satellite style, and not by accident. Nahuel
 * Huapi from above is a dark green blur: the trail is under the canopy and
 * invisible, and white numbered markers have nothing to sit against. The
 * outdoors style draws contour lines, water and the paths themselves, which
 * OpenStreetMap already has for all three trails.
 */
const STYLE_OWNER = 'mapbox';
const STYLE_ID = 'outdoors-v12';

/** Matches the viewBox in TrailMap.svelte. Both must stay in step. */
export const MAP_WIDTH = 398;
export const MAP_HEIGHT = 300;

/** Keeps markers and their leader lines clear of the edges. */
const MAP_PADDING = 34;

/** Mapbox tiles are 512 px at zoom 0. */
const TILE_SIZE = 512;

/** The API rejects anything past this. */
const MAX_ZOOM = 22;

export const hasMapboxToken = () => TOKEN.length > 0;

/** Web Mercator, normalised so the whole world is 1 unit across. */
function mercator(lat: number, lng: number) {
	const latRad = (Math.max(Math.min(lat, 85.05112878), -85.05112878) * Math.PI) / 180;
	return {
		x: (lng + 180) / 360,
		y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
	};
}

export type MapView = {
	lat: number;
	lng: number;
	zoom: number;
	/** World width in pixels at this zoom, kept so projection needs no recompute. */
	worldSize: number;
};

/**
 * The centre and zoom that fit every point inside the padded panel. Returns
 * null when there is nothing to frame.
 */
export function getMapView(points: TourPoint[]): MapView | null {
	if (points.length === 0) return null;

	const projected = points.map((p) => mercator(p.lat, p.lng));
	const minX = Math.min(...projected.map((p) => p.x));
	const maxX = Math.max(...projected.map((p) => p.x));
	const minY = Math.min(...projected.map((p) => p.y));
	const maxY = Math.max(...projected.map((p) => p.y));

	// A single point, or several on one line, would divide by zero. The floor is
	// about 30 m of world at this latitude, which frames one point sensibly.
	const spanX = Math.max(maxX - minX, 1e-7);
	const spanY = Math.max(maxY - minY, 1e-7);

	const usableW = MAP_WIDTH - MAP_PADDING * 2;
	const usableH = MAP_HEIGHT - MAP_PADDING * 2;
	const worldSize = Math.min(usableW / spanX, usableH / spanY);

	const zoom = Math.min(Math.log2(worldSize / TILE_SIZE), MAX_ZOOM);
	// Clamping the zoom changes the scale, so derive the world size back from
	// the zoom actually used rather than from the ideal fit.
	const clampedWorldSize = TILE_SIZE * Math.pow(2, zoom);

	const centreX = (minX + maxX) / 2;
	const centreY = (minY + maxY) / 2;

	// Back to degrees, because the API wants the centre as lon,lat.
	const lng = centreX * 360 - 180;
	const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * centreY)));

	return {
		lat: (latRad * 180) / Math.PI,
		lng,
		zoom,
		worldSize: clampedWorldSize
	};
}

/**
 * A point's position on the panel, in the same coordinates as the image. This
 * is the function that keeps the markers honest.
 */
export function projectPoint(view: MapView, lat: number, lng: number) {
	const point = mercator(lat, lng);
	const centre = mercator(view.lat, view.lng);
	return {
		x: (point.x - centre.x) * view.worldSize + MAP_WIDTH / 2,
		y: (point.y - centre.y) * view.worldSize + MAP_HEIGHT / 2
	};
}

/**
 * The image URL, or null without a token, so the app runs unchanged for anyone
 * who has not set one.
 *
 * `logo=false&attribution=false` strips the credits Mapbox burns into the
 * bottom of the image. They are not dropped: TrailMap draws them itself in the
 * top left, which the attribution guidelines allow and which keeps them off the
 * place names along the bottom edge.
 */
export function getStaticImageUrl(points: TourPoint[]): string | null {
	if (!hasMapboxToken()) return null;
	const view = getMapView(points);
	if (!view) return null;

	const centre = `${view.lng.toFixed(6)},${view.lat.toFixed(6)},${view.zoom.toFixed(4)},0,0`;
	const size = `${MAP_WIDTH}x${MAP_HEIGHT}@2x`;

	return (
		`https://api.mapbox.com/styles/v1/${STYLE_OWNER}/${STYLE_ID}/static/${centre}/${size}` +
		`?logo=false&attribution=false&access_token=${encodeURIComponent(TOKEN)}`
	);
}
