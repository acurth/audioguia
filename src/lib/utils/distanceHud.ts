import type { TourPoint } from '$lib/utils/tourMeta';

/**
 * The sums behind the distance box on the Recorrido screen: which point it
 * points at, which way that is, and how the distance is written.
 */

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * The direction from one place to another, in degrees clockwise from true
 * north. Great-circle, so it holds from a few metres to Boston.
 */
export function bearingDegrees(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number }
): number {
	const p1 = toRad(from.lat);
	const p2 = toRad(to.lat);
	const dL = toRad(to.lng - from.lng);
	const y = Math.sin(dL) * Math.cos(p2);
	const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dL);
	return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const oneDecimal = new Intl.NumberFormat('es-AR', {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1
});
const whole = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/**
 * "54 m", "345 m", "7,8 km", "9.284 km". From 100 m the metres round to 5,
 * so the number does not flicker with every GPS reading.
 */
export function formatDistance(meters: number): { value: string; unit: 'm' | 'km' } {
	if (meters < 1000) {
		const rounded = meters < 100 ? Math.round(meters) : Math.round(meters / 5) * 5;
		return { value: whole.format(rounded), unit: 'm' };
	}
	const km = meters / 1000;
	if (km < 100) return { value: oneDecimal.format(km), unit: 'km' };
	return { value: whole.format(Math.round(km)), unit: 'km' };
}

/**
 * The band a distance falls in, for the screen reader: it speaks again only
 * when this changes. 10 m steps under 100 m, 50 m under 1 km, then 1 km.
 */
export function distanceBand(meters: number): number {
	if (meters < 100) return Math.round(meters / 10);
	if (meters < 1000) return 100 + Math.round(meters / 50);
	return 1000 + Math.round(meters / 1000);
}

export type HudTarget = { point: TourPoint; number: string; isStart: boolean };

/**
 * The point the box points at: the first point after the furthest one heard.
 * Before anything has been heard that is point 01, the start of the trail.
 * Once the last point has been heard there is nothing left to walk to, and
 * the box goes away.
 *
 * "After the furthest one heard", not "the first one not heard": a point
 * missed behind the walker must not turn the arrow round.
 */
export function hudTarget(points: TourPoint[], triggeredIds: string[]): HudTarget | null {
	if (points.length === 0) return null;
	let furthest = -1;
	points.forEach((point, index) => {
		if (triggeredIds.includes(point.id)) furthest = index;
	});
	const next = points[furthest + 1];
	if (!next) return null;
	return {
		point: next,
		// The id is the number on the map marker, so the two always agree.
		number: next.id.padStart(2, '0'),
		isStart: furthest === -1
	};
}
