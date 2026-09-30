import { browser } from '$app/environment';
import { readable } from 'svelte/store';

/**
 * True while the browser says it has a network. It can say true with no real
 * signal (Wi-Fi with no internet), so use it for notices, not to block
 * anything. False is reliable: there is no network at all.
 */
export const onlineStore = readable(true, (set) => {
	if (!browser) return;
	const update = () => set(navigator.onLine);
	update();
	window.addEventListener('online', update);
	window.addEventListener('offline', update);
	return () => {
		window.removeEventListener('online', update);
		window.removeEventListener('offline', update);
	};
});
