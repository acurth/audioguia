import { writable } from 'svelte/store';
import type { NavSection } from '$lib/nav';

/**
 * Which list the open trail was reached from. Detalle is not a tab of its own,
 * so it marks the tab you came from, the way the tablet marks Explorar while
 * a trail is open beside the list. Explorar is the answer for a link opened
 * from outside the app, which is where most shared links land.
 *
 * Explorar and Offline write the key; Detalle reads it for its back button and
 * the layout reads this store for the marked tab.
 */
export const LAST_TOUR_LIST_KEY = 'last-tour-list-path';

export const listOrigin = writable<Extract<NavSection, 'explorar' | 'offline'>>('explorar');

/** Reads the stored path and sets the store. Safe to call on any screen. */
export function readListOrigin(base: string): string {
	if (typeof sessionStorage === 'undefined') return `${base}/explorar`;
	const saved = sessionStorage.getItem(LAST_TOUR_LIST_KEY);
	const isOffline = saved === `${base}/offline`;
	listOrigin.set(isOffline ? 'offline' : 'explorar');
	return isOffline ? `${base}/offline` : `${base}/explorar`;
}
