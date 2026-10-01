import { writable } from 'svelte/store';

/**
 * Which way the top of the phone is facing, from true north, for the arrow
 * in the distance box on the Recorrido screen.
 *
 * The phone's compass gives magnetic north and the trail coordinates are from
 * true north, so the magnetic declination is added. At Bariloche it is
 * +5.52° (east), from the NOAA calculator (WMM-2025) for lat -41.13,
 * lng -71.31, checked on 2026-09-30. It moves about -0.14° a year, so it is
 * worth checking again around 2030.
 */
export const DECLINATION_DEG = 5.5;

/** How much of each new reading goes into the arrow, per frame. */
const SMOOTHING = 0.2;

/**
 * off: not asked yet, the box invites a tap. asking: waiting for the answer
 * or the first reading. unavailable: refused, or no sensor (a computer), so
 * the box shows the way on the map. on: real readings are arriving.
 */
export type CompassStatus = 'off' | 'asking' | 'on' | 'unavailable';

export type CompassState = {
	status: CompassStatus;
	/** True once a real compass reading has arrived. False means map mode. */
	active: boolean;
	/** Smoothed true heading of the top of the phone, 0 to 360. */
	heading: number | null;
	/** Last raw reading and screen angle, for the dev panel only. */
	raw: number | null;
	screenAngle: number;
};

const initial: CompassState = {
	status: 'off',
	active: false,
	heading: null,
	raw: null,
	screenAngle: 0
};

export const compass = writable<CompassState>({
	...initial,
	heading: null,
	raw: null,
	screenAngle: 0
});

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** A computer says yes but never sends a reading. This long, then give up. */
const NO_READING_MS = 3000;

let listening = false;
let noReadingTimer = 0;
// The heading is smoothed as a vector, never as degrees: averaging 359° and
// 1° as numbers gives 180°, the opposite direction.
let targetX = 0;
let targetY = 0;
let smoothX = 0;
let smoothY = 0;
let hasReading = false;
let frame = 0;

function screenAngle(): number {
	if (typeof screen !== 'undefined' && typeof screen.orientation?.angle === 'number') {
		return screen.orientation.angle;
	}
	const legacy = (window as { orientation?: unknown }).orientation;
	return typeof legacy === 'number' ? legacy : 0;
}

type OrientationReading = DeviceOrientationEvent & { webkitCompassHeading?: number };

function handleOrientation(event: OrientationReading): void {
	let heading: number | null = null;
	if (typeof event.webkitCompassHeading === 'number' && event.webkitCompassHeading >= 0) {
		// iOS: degrees clockwise from magnetic north.
		heading = event.webkitCompassHeading;
	} else if (event.absolute === true && typeof event.alpha === 'number') {
		// Android: alpha turns the other way.
		heading = (360 - event.alpha) % 360;
	}
	if (heading === null) return;

	// In landscape the top of the screen is a side of the phone. Whether iOS
	// already allows for this in webkitCompassHeading is one of the things to
	// check on a real iPhone; the dev panel shows both numbers.
	const angle = screenAngle();
	const trueHeading = (heading + angle + DECLINATION_DEG + 360) % 360;

	targetX = Math.cos(toRad(trueHeading));
	targetY = Math.sin(toRad(trueHeading));
	if (!hasReading) {
		smoothX = targetX;
		smoothY = targetY;
		hasReading = true;
		window.clearTimeout(noReadingTimer);
		compass.update((s) => ({ ...s, status: 'on', active: true }));
	}
	compass.update((s) => ({ ...s, raw: heading, screenAngle: angle }));
	if (!frame) frame = requestAnimationFrame(step);
}

/** One smoothing step per frame, however many readings arrived. */
function step(): void {
	frame = 0;
	smoothX += (targetX - smoothX) * SMOOTHING;
	smoothY += (targetY - smoothY) * SMOOTHING;
	const heading = (toDeg(Math.atan2(smoothY, smoothX)) + 360) % 360;
	compass.update((s) => ({ ...s, heading }));
	// Keep easing until the arrow has caught up with the last reading.
	if (Math.hypot(targetX - smoothX, targetY - smoothY) > 0.002) {
		frame = requestAnimationFrame(step);
	}
}

function listen(): void {
	if (listening) return;
	listening = true;
	// Android sends the absolute (north-based) readings under their own name.
	const eventName =
		'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
	window.addEventListener(eventName, handleOrientation as EventListener);
	noReadingTimer = window.setTimeout(() => {
		if (!hasReading) compass.update((s) => ({ ...s, status: 'unavailable' }));
	}, NO_READING_MS);
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

const unavailable = () => compass.update((s) => ({ ...s, status: 'unavailable' }));

/**
 * Starts the compass. Called only from the tap on the distance box, which
 * says "Tocá para la brújula": asking for motion access when the walk
 * starts put it right after the location prompt, before anyone knew what it
 * was for. On iOS this must run inside the tap, before anything is awaited,
 * or Safari refuses without asking.
 */
export function enableCompass(): void {
	if (typeof window === 'undefined') return;
	if (listening) return;
	if (!('DeviceOrientationEvent' in window)) {
		unavailable();
		return;
	}
	compass.update((s) => ({ ...s, status: 'asking' }));

	const api = window.DeviceOrientationEvent as unknown as PermissionApi;
	if (typeof api.requestPermission !== 'function') {
		listen();
		return;
	}

	api
		.requestPermission()
		.then((answer) => {
			if (answer === 'granted') listen();
			else unavailable();
		})
		.catch(unavailable);
}

/** Stops listening and goes back to map mode, for when the walk ends. */
export function disableCompass(): void {
	if (typeof window === 'undefined') return;
	window.clearTimeout(noReadingTimer);
	window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
	window.removeEventListener('deviceorientation', handleOrientation as EventListener);
	if (frame) cancelAnimationFrame(frame);
	frame = 0;
	listening = false;
	hasReading = false;
	compass.set({ ...initial });
}
