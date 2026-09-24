import { browser } from '$app/environment';
import type { TourSessionState } from '$lib/stores/tourSession';

/**
 * The walk, written down so a reload does not lose it.
 *
 * Why this exists: the session store lives in memory, so any reload put the
 * screen back to "Sin iniciar" with the points heard back at zero. That is not
 * a rare case on a trail — Safari on iOS discards background tabs on its own,
 * so putting the phone in a pocket for a few minutes was enough to lose the
 * walk.
 *
 * What is deliberately not saved: the position, the distances and whether the
 * audio was playing. Those describe a moment, not the walk, and the GPS gives
 * them back within seconds. Audio is restored paused, because a browser will
 * not start sound without the person touching something.
 */

const STORAGE_KEY = 'audioguia-session-v1';

/**
 * After six hours of silence the walk is over, whatever the storage says. That
 * covers a whole day out, lunch included, while still giving someone who opens
 * the app the next morning a clean start rather than a stale "En recorrido".
 */
const MAX_IDLE_MS = 6 * 60 * 60 * 1000;

export type StoredSession = {
	version: 1;
	slug: string;
	triggeredIds: string[];
	currentPointId: string | null;
	currentTime: number;
	elapsedMs: number;
	walkedMeters: number;
	selectedProgressMeters: number | null;
	playbackRate: number;
	photoDismissedIds: string[];
	/** When the walk was last touched, for the idle check above. */
	savedAt: number;
};

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

const finite = (value: unknown, fallback: number): number =>
	typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function saveSession(state: TourSessionState): void {
	if (!browser) return;
	if (state.status !== 'tracking' || !state.slug) return;

	const stored: StoredSession = {
		version: 1,
		slug: state.slug,
		triggeredIds: state.triggeredIds,
		currentPointId: state.currentPointId,
		currentTime: state.currentTime,
		elapsedMs: state.elapsedMs,
		walkedMeters: state.walkedMeters,
		selectedProgressMeters: state.selectedProgressMeters,
		playbackRate: state.playbackRate,
		photoDismissedIds: state.photoDismissedIds,
		savedAt: Date.now()
	};

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
	} catch (err) {
		// A full or blocked store is not worth breaking the walk over.
		console.warn('Could not save the session', err);
	}
}

export function clearSession(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (err) {
		console.warn('Could not clear the session', err);
	}
}

/**
 * The saved walk, or null when there is none, it is too old, or it is damaged.
 * Anything unreadable is deleted rather than left to fail again next time.
 */
export function loadSession(): StoredSession | null {
	if (!browser) return null;

	let raw: string | null = null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch (err) {
		console.warn('Could not read the session', err);
		return null;
	}
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<StoredSession>;

		if (parsed?.version !== 1 || typeof parsed.slug !== 'string') {
			clearSession();
			return null;
		}
		if (Date.now() - finite(parsed.savedAt, 0) > MAX_IDLE_MS) {
			clearSession();
			return null;
		}

		return {
			version: 1,
			slug: parsed.slug,
			triggeredIds: isStringArray(parsed.triggeredIds) ? parsed.triggeredIds : [],
			currentPointId: typeof parsed.currentPointId === 'string' ? parsed.currentPointId : null,
			currentTime: finite(parsed.currentTime, 0),
			elapsedMs: finite(parsed.elapsedMs, 0),
			walkedMeters: finite(parsed.walkedMeters, 0),
			selectedProgressMeters:
				typeof parsed.selectedProgressMeters === 'number' &&
				Number.isFinite(parsed.selectedProgressMeters)
					? parsed.selectedProgressMeters
					: null,
			playbackRate: finite(parsed.playbackRate, 1),
			photoDismissedIds: isStringArray(parsed.photoDismissedIds) ? parsed.photoDismissedIds : [],
			savedAt: finite(parsed.savedAt, Date.now())
		};
	} catch (err) {
		console.warn('The saved session was unreadable', err);
		clearSession();
		return null;
	}
}
