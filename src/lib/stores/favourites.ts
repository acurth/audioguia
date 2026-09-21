import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * Favourite trails, kept on this device only. There is no account to sync
 * them to, and marking a trail should not need one.
 */

const STORAGE_KEY = 'favourite-tours';

export const favouritesStore = writable<string[]>([]);

let initialized = false;

export function initFavourites(): void {
	if (!browser || initialized) return;
	initialized = true;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				favouritesStore.set(parsed.filter((id): id is string => typeof id === 'string'));
			}
		}
	} catch (err) {
		console.error('Failed to read favourites', err);
	}

	favouritesStore.subscribe((ids) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
		} catch {
			// Storage can be blocked. The app still works, the mark just does
			// not survive a reload.
		}
	});
}

export function toggleFavourite(id: string): void {
	favouritesStore.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
}
