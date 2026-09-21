import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * A single position reading, for the screens that only need to know roughly
 * where you are: Explorar sorting by distance, and the trailhead distance on
 * the cards. The tour in progress keeps its own continuous watch.
 */

export type PositionStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

export type PositionState = {
	status: PositionStatus;
	coords: { lat: number; lng: number } | null;
	/** Ready to show, already in Spanish. */
	message: string;
};

const initial: PositionState = { status: 'idle', coords: null, message: '' };

export const positionStore = writable<PositionState>(initial);

let inFlight = false;

/** Asks the browser once. Repeated calls while one is pending are ignored. */
export function requestPosition(): void {
	if (!browser || inFlight) return;

	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		positionStore.set({
			status: 'unavailable',
			coords: null,
			message: 'Tu navegador no puede darnos la ubicación.'
		});
		return;
	}

	inFlight = true;
	positionStore.set({ status: 'locating', coords: null, message: 'Buscando tu ubicación…' });

	navigator.geolocation.getCurrentPosition(
		(pos) => {
			inFlight = false;
			positionStore.set({
				status: 'ready',
				coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
				message: ''
			});
		},
		(err) => {
			inFlight = false;
			const denied = err.code === err.PERMISSION_DENIED;
			positionStore.set({
				status: denied ? 'denied' : 'unavailable',
				coords: null,
				message: denied
					? 'No tenemos permiso para usar tu ubicación. Podés ordenar la lista por nombre o por largo.'
					: 'No pudimos obtener tu ubicación. Podés ordenar la lista por nombre o por largo.'
			});
		},
		{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
	);
}
