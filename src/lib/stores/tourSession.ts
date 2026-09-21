import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { TourView } from '$lib/data/tourView';
import { distanceMeters, type TourPoint } from '$lib/utils/tourMeta';
import { playTrackingOff, playTrackingOn } from '$lib/utils/earcons';
import { isWakeLockSupported, releaseWakeLock, requestWakeLock } from '$lib/utils/wakeLock';

/**
 * The walk in progress: the GPS watch, the audio player, the wake lock and
 * everything derived from them.
 *
 * It lives outside the page component on purpose. The narration has to keep
 * playing when the person leaves the tour screen — that is what makes the
 * mini player on Inicio real rather than decorative — and a component that
 * unmounts would take the audio and the GPS watch with it.
 */

// Trigger geometry, unchanged from the first version of the app.
const DEFAULT_TRIGGER_RADIUS_METERS = 10;
const MAX_EFFECTIVE_RADIUS_METERS = 25;
const ACCURACY_MULTIPLIER = 1.5;
const POOR_ACCURACY_THRESHOLD_METERS = 20;
const MAX_ACCURACY_FOR_TRIGGER_METERS = 50;

/**
 * How far the walker has to get from a point before its photo closes itself.
 * Under the canopy the phone's GPS is 5 to 10 metres out, so a smaller
 * threshold would make the photo open and close while they stand still
 * looking at it, which is worse than leaving it open.
 */
const PHOTO_CLOSE_DISTANCE_METERS = 20;

// Movement detection, also unchanged.
const MOTION_DISTANCE_METERS = 8;
const MOTION_STILL_METERS = 3;
const MOTION_WINDOW_MS = 12000;

const TICK_MS = 500;

export type TourSessionState = {
	status: 'idle' | 'tracking';
	slug: string | null;
	name: string | null;
	points: TourPoint[];
	/** Ids of the points whose narration has already fired. */
	triggeredIds: string[];
	/** The point whose narration is loaded, playing or paused. */
	currentPointId: string | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	playbackRate: number;
	position: { lat: number; lng: number; accuracy: number } | null;
	effectiveRadius: number | null;
	gpsWarning: string | null;
	isMoving: boolean;
	/** Metres from the current position to each point, by point id. */
	distances: Record<string, number>;
	/** Metres walked along the trail, from projecting the position onto it. */
	walkedMeters: number;
	elapsedMs: number;
	wakeLockActive: boolean;
	wakeLockAvailable: boolean;
	statusMessage: string;
	/** The point photo is showing over the map. */
	photoOpen: boolean;
	/** The photo is filling the screen. */
	photoFullscreen: boolean;
	/** Points whose photo was closed by hand: those never reopen on their own. */
	photoDismissedIds: string[];
	/** The point whose narration has finished playing. */
	narrationEndedFor: string | null;
};

const initialState: TourSessionState = {
	status: 'idle',
	slug: null,
	name: null,
	points: [],
	triggeredIds: [],
	currentPointId: null,
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	playbackRate: 1,
	position: null,
	effectiveRadius: null,
	gpsWarning: null,
	isMoving: false,
	distances: {},
	walkedMeters: 0,
	elapsedMs: 0,
	wakeLockActive: false,
	wakeLockAvailable: false,
	statusMessage: 'Listo para iniciar el recorrido',
	photoOpen: false,
	photoFullscreen: false,
	photoDismissedIds: [],
	narrationEndedFor: null
};

export const tourSession = writable<TourSessionState>(initialState);

let audio: HTMLAudioElement | null = null;
let watchId: number | null = null;
let tickId: number | null = null;
let startedAt = 0;
let lastMotionSample: { lat: number; lng: number; time: number } | null = null;
let listenersAttached = false;

const patch = (next: Partial<TourSessionState>) =>
	tourSession.update((state) => ({ ...state, ...next }));

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getEffectiveRadius(accuracy: number): number {
	const scaled = Math.max(DEFAULT_TRIGGER_RADIUS_METERS, accuracy * ACCURACY_MULTIPLIER);
	return clamp(scaled, DEFAULT_TRIGGER_RADIUS_METERS, MAX_EFFECTIVE_RADIUS_METERS);
}

/** Cumulative distance from the first point to each point, in metres. */
export function cumulativeMeters(points: TourPoint[]): number[] {
	const out: number[] = [];
	let total = 0;
	points.forEach((point, index) => {
		if (index > 0) total += distanceMeters(points[index - 1], point);
		out.push(total);
	});
	return out;
}

/**
 * How far along the trail the walker is, by dropping their position onto the
 * nearest segment of the line between points. This is what lets the progress
 * head go backwards when they turn around, rather than only counting points
 * already heard.
 */
export function projectOntoTrail(
	points: TourPoint[],
	position: { lat: number; lng: number }
): number {
	if (points.length < 2) return 0;
	const cumulative = cumulativeMeters(points);
	let best = { distanceToTrail: Number.POSITIVE_INFINITY, along: 0 };

	for (let i = 1; i < points.length; i += 1) {
		const a = points[i - 1];
		const b = points[i];
		// Local flat approximation: good enough over a few hundred metres.
		const latScale = Math.cos((a.lat * Math.PI) / 180);
		const ax = 0;
		const ay = 0;
		const bx = (b.lng - a.lng) * latScale;
		const by = b.lat - a.lat;
		const px = (position.lng - a.lng) * latScale;
		const py = position.lat - a.lat;

		const segmentLengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
		const t = segmentLengthSq === 0 ? 0 : clamp((px * bx + py * by) / segmentLengthSq, 0, 1);
		const closest = { lat: a.lat + by * t, lng: a.lng + (b.lng - a.lng) * t };
		const distanceToTrail = distanceMeters(position, closest);

		if (distanceToTrail < best.distanceToTrail) {
			const segmentMeters = distanceMeters(a, b);
			best = { distanceToTrail, along: cumulative[i - 1] + segmentMeters * t };
		}
	}

	return best.along;
}

function ensureAudio(): HTMLAudioElement | null {
	if (!browser) return null;
	if (!audio) {
		audio = new Audio();
		audio.preload = 'auto';
	}
	if (!listenersAttached && audio) {
		listenersAttached = true;
		audio.addEventListener('timeupdate', () => {
			patch({ currentTime: audio?.currentTime ?? 0 });
		});
		audio.addEventListener('loadedmetadata', () => {
			patch({ duration: Number.isFinite(audio?.duration ?? NaN) ? (audio?.duration ?? 0) : 0 });
		});
		audio.addEventListener('play', () => patch({ isPlaying: true }));
		audio.addEventListener('pause', () => patch({ isPlaying: false }));
		audio.addEventListener('ended', () => {
			patch({
				isPlaying: false,
				currentTime: 0,
				narrationEndedFor: get(tourSession).currentPointId
			});
		});
		audio.addEventListener('error', () => {
			patch({
				isPlaying: false,
				statusMessage: 'No se pudo reproducir el audio de este punto.'
			});
		});
	}
	return audio;
}

/**
 * A tenth of a second of silence, as a data URI. It has to be a real source:
 * calling play() on an element with no source leaves the promise pending for
 * ever in Chrome, which would hang the start of the walk.
 */
const SILENCE =
	'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

/**
 * iOS and Chrome refuse to start audio that no gesture asked for, and the
 * first narration fires from the GPS, not from a tap. Playing a silent clip
 * inside the tap that starts the walk buys the permission for later.
 */
async function unlockAudio(): Promise<void> {
	const player = ensureAudio();
	if (!player) return;

	const previousMuted = player.muted;
	player.muted = true;
	player.src = SILENCE;

	try {
		await player.play();
		player.pause();
	} catch {
		// Nothing to do: the first point will simply need a tap.
	}

	player.currentTime = 0;
	player.muted = previousMuted;
}

export async function playPoint(point: TourPoint, base: string): Promise<void> {
	const player = ensureAudio();
	if (!player || !point.audio) return;

	player.pause();
	player.src = `${base}/${point.audio}`;
	player.currentTime = 0;
	player.playbackRate = get(tourSession).playbackRate;

	// Arriving at a point shows its photo, unless this point's photo was
	// closed by hand earlier.
	const state = get(tourSession);
	const hasPhoto = Boolean(point.photos?.[0]);
	const dismissed = state.photoDismissedIds.includes(point.id);
	patch({
		currentPointId: point.id,
		currentTime: 0,
		duration: 0,
		narrationEndedFor: null,
		photoOpen: hasPhoto && !dismissed,
		photoFullscreen: false
	});

	if (hasPhoto && !dismissed) buzz();

	try {
		await player.play();
		patch({ isPlaying: true, statusMessage: `Reproduciendo: ${point.name}` });
	} catch (err) {
		console.error('Playback failed', err);
		patch({
			isPlaying: false,
			statusMessage: `Tocá reproducir para escuchar: ${point.name}`
		});
	}
}

/**
 * A short buzz when the photo appears. The companion may be watching the
 * path rather than the screen, and this is the only way to tell them
 * something arrived without talking over the narration.
 */
function buzz(): void {
	if (!browser || typeof navigator.vibrate !== 'function') return;
	try {
		navigator.vibrate(30);
	} catch {
		// Some browsers expose it and then refuse. Nothing depends on it.
	}
}

export function openPhoto(): void {
	patch({ photoOpen: true });
}

/** Closing by hand means this point's photo stays closed for good. */
export function closePhoto(): void {
	const state = get(tourSession);
	const id = state.currentPointId;
	patch({
		photoOpen: false,
		photoFullscreen: false,
		photoDismissedIds:
			id && !state.photoDismissedIds.includes(id)
				? [...state.photoDismissedIds, id]
				: state.photoDismissedIds
	});
}

export function togglePhoto(): void {
	if (get(tourSession).photoOpen) closePhoto();
	else openPhoto();
}

export function setPhotoFullscreen(open: boolean): void {
	patch({ photoFullscreen: open });
}

export function togglePlay(): void {
	const player = ensureAudio();
	if (!player || !player.src) return;
	if (player.paused) {
		void player.play().catch(() => patch({ isPlaying: false }));
	} else {
		player.pause();
	}
}

export function seekTo(seconds: number): void {
	const player = ensureAudio();
	if (!player || !Number.isFinite(player.duration)) return;
	player.currentTime = clamp(seconds, 0, player.duration);
	patch({ currentTime: player.currentTime });
}

export function skipSeconds(delta: number): void {
	const player = ensureAudio();
	if (!player) return;
	seekTo(player.currentTime + delta);
}

/** Cycles through the speeds the transport row offers. */
export function cyclePlaybackRate(): void {
	const rates = [1, 1.25, 1.5, 0.75];
	const current = get(tourSession).playbackRate;
	const next = rates[(rates.indexOf(current) + 1) % rates.length] ?? 1;
	const player = ensureAudio();
	if (player) player.playbackRate = next;
	patch({ playbackRate: next });
}

function handlePosition(pos: GeolocationPosition, base: string): void {
	const { latitude, longitude, accuracy } = pos.coords;
	const now = Date.now();
	const state = get(tourSession);
	const points = state.points;

	const distances: Record<string, number> = {};
	for (const point of points) {
		distances[point.id] = distanceMeters({ lat: latitude, lng: longitude }, point);
	}

	// Movement: only judged while the fix is good enough to trust.
	let isMoving = state.isMoving;
	if (accuracy <= POOR_ACCURACY_THRESHOLD_METERS) {
		if (!lastMotionSample) {
			lastMotionSample = { lat: latitude, lng: longitude, time: now };
		} else if (now - lastMotionSample.time >= MOTION_WINDOW_MS) {
			const moved = distanceMeters(lastMotionSample, { lat: latitude, lng: longitude });
			if (moved >= MOTION_DISTANCE_METERS) {
				isMoving = true;
				lastMotionSample = { lat: latitude, lng: longitude, time: now };
			} else if (moved < MOTION_STILL_METERS) {
				isMoving = false;
				lastMotionSample = { lat: latitude, lng: longitude, time: now };
			}
		}
	}

	const effectiveRadius = getEffectiveRadius(accuracy);

	patch({
		position: { lat: latitude, lng: longitude, accuracy },
		effectiveRadius,
		gpsWarning: accuracy > POOR_ACCURACY_THRESHOLD_METERS ? 'GPS poco preciso' : null,
		distances,
		isMoving,
		walkedMeters: projectOntoTrail(points, { lat: latitude, lng: longitude })
	});

	// The photo closes itself only when both things are true: the narration
	// finished, and the walker has moved away. Either one on its own would
	// take the photo away while they are still using it.
	const afterPatch = get(tourSession);
	if (afterPatch.photoOpen && afterPatch.currentPointId) {
		const away = distances[afterPatch.currentPointId] ?? 0;
		const narrationDone = afterPatch.narrationEndedFor === afterPatch.currentPointId;
		if (narrationDone && away > PHOTO_CLOSE_DISTANCE_METERS) {
			patch({ photoOpen: false, photoFullscreen: false });
		}
	}

	if (get(tourSession).status !== 'tracking') return;
	if (accuracy > MAX_ACCURACY_FOR_TRIGGER_METERS) return;

	for (const point of points) {
		if (get(tourSession).triggeredIds.includes(point.id)) continue;
		if (distances[point.id] > effectiveRadius) continue;

		tourSession.update((s) => ({ ...s, triggeredIds: [...s.triggeredIds, point.id] }));
		void playPoint(point, base);
		break;
	}
}

function handlePositionError(err: GeolocationPositionError): void {
	console.warn('Geolocation error', err.code, err.message);
	// A single failed reading while walking is normal under tree cover, and
	// replacing the status with an error every time would be noise. Only say
	// something when we have never had a position at all.
	if (get(tourSession).position) return;

	const message =
		err.code === err.PERMISSION_DENIED
			? 'No tenemos permiso para usar tu ubicación, así que los audios no se van a disparar solos.'
			: 'Todavía no pudimos ubicarte. Probá salir a cielo abierto unos segundos.';
	patch({ statusMessage: message });
}

async function syncWakeLock(active: boolean): Promise<void> {
	if (active) {
		patch({ wakeLockActive: await requestWakeLock() });
	} else {
		await releaseWakeLock();
		patch({ wakeLockActive: false });
	}
}

function handleVisibilityChange(): void {
	if (document.visibilityState === 'hidden') {
		void syncWakeLock(false);
		return;
	}
	if (get(tourSession).status === 'tracking') void syncWakeLock(true);
}

function handleWakeLockRelease(): void {
	patch({ wakeLockActive: false });
}

export async function startTour(tour: TourView, base: string): Promise<void> {
	if (!browser) return;
	if (get(tourSession).status === 'tracking' && get(tourSession).slug === tour.slug) return;

	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		patch({ statusMessage: 'Tu navegador no soporta geolocalización.' });
		return;
	}

	await unlockAudio();

	startedAt = Date.now();
	lastMotionSample = null;

	tourSession.set({
		...initialState,
		status: 'tracking',
		slug: tour.slug,
		name: tour.name,
		points: tour.points,
		wakeLockAvailable: isWakeLockSupported(),
		statusMessage: 'Iniciando seguimiento de ubicación…'
	});

	void syncWakeLock(true);
	void playTrackingOn();

	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('wake-lock-release', handleWakeLockRelease);

	watchId = navigator.geolocation.watchPosition(
		(pos) => handlePosition(pos, base),
		handlePositionError,
		{ enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
	);

	tickId = window.setInterval(() => {
		patch({ elapsedMs: Date.now() - startedAt });
	}, TICK_MS);
}

export function stopTour(): void {
	if (!browser) return;
	if (get(tourSession).status === 'tracking') void playTrackingOff();

	if (watchId !== null && navigator.geolocation) {
		navigator.geolocation.clearWatch(watchId);
		watchId = null;
	}
	if (tickId !== null) {
		window.clearInterval(tickId);
		tickId = null;
	}

	document.removeEventListener('visibilitychange', handleVisibilityChange);
	window.removeEventListener('wake-lock-release', handleWakeLockRelease);

	if (audio) {
		audio.pause();
		audio.removeAttribute('src');
	}

	void syncWakeLock(false);
	lastMotionSample = null;
	tourSession.set({ ...initialState, statusMessage: 'Seguimiento detenido' });
}

/** The line a screen reader should hear about the screen staying awake. */
export function wakeLockLine(state: TourSessionState): string {
	if (state.status !== 'tracking') return '';
	if (!state.wakeLockAvailable) return 'Pantalla activa: no disponible en este navegador';
	if (state.wakeLockActive) return 'Pantalla activa: sí';
	return 'Pantalla activa: no. Podés desactivar el bloqueo automático del teléfono.';
}
