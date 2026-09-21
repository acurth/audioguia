/**
 * Shared derivations over a tour: length, distance, and the strings the cards
 * and the detail screen print. Kept in one place so Explorar, Offline, Inicio
 * and Detalle cannot disagree with each other.
 */

export type TourPoint = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	radius?: number;
	audio?: string;
	photos?: string[];
	/**
	 * What the photo shows, for a screen reader. It has to describe the
	 * thing, not repeat the point name. Left out, the photo is treated as
	 * decorative, because a bad alt is worse than none.
	 */
	photoAlt?: string;
};

export type Difficulty = 'facil' | 'exigente';

const EARTH_RADIUS_METERS = 6371000;

const toRad = (value: number) => (value * Math.PI) / 180;

export function distanceMeters(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number }
): number {
	const dLat = toRad(to.lat - from.lat);
	const dLng = toRad(to.lng - from.lng);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimated trail length: the straight lines between consecutive points added
 * up. It is not the walked distance, because the JSON stores the points and
 * not the track, so every screen that prints it calls it an estimate.
 */
export function estimateTrailMeters(points: TourPoint[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i += 1) {
		total += distanceMeters(points[i - 1], points[i]);
	}
	return total;
}

/** Kilometres in Spanish notation: 0,52 km. */
export function formatKm(meters: number): string {
	return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

/** Distance to the trailhead, as the cards print it: "a ~740 m", "a ~3,4 km". */
export function formatApproxDistance(meters: number): string {
	if (meters < 1000) return `a ~${Math.round(meters)} m`;
	return `a ~${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatMB(bytes?: number): string {
	if (!bytes) return '0 MB';
	return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}

export function formatPointCount(count: number): string {
	return count === 1 ? '1 punto' : `${count} puntos`;
}

export function difficultyLabel(difficulty?: string): string | null {
	if (difficulty === 'facil') return 'Sendero fácil';
	if (difficulty === 'exigente') return 'Sendero exigente';
	return null;
}
