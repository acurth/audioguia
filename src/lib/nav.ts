import type { IconName } from '$lib/components/ui/Icon.svelte';

/**
 * The four fixed sections of the redesign. Sobre, Detalle and Recorrido are
 * not tabs: they carry a back button instead.
 */
export type NavSection = 'inicio' | 'explorar' | 'offline' | 'cuenta';

export type NavItem = {
	section: NavSection;
	label: string;
	icon: IconName;
	/** Path relative to the app base, without the leading base segment. */
	path: string;
};

export const NAV_ITEMS: NavItem[] = [
	{ section: 'inicio', label: 'Inicio', icon: 'home', path: '/' },
	{ section: 'explorar', label: 'Explorar', icon: 'compass', path: '/explorar' },
	{ section: 'offline', label: 'Offline', icon: 'download', path: '/offline' },
	{ section: 'cuenta', label: 'Cuenta', icon: 'account', path: '/cuenta' }
];

/**
 * Which tab is current, from the SvelteKit route id. The route id is used
 * instead of the pathname because it is the same string whether the app is
 * served from the domain root or from a subfolder.
 *
 * Routes that are not tabs return null, and then no tab is marked current.
 */
export function sectionForRoute(routeId: string | null): NavSection | null {
	if (!routeId) return null;
	if (routeId === '/') return 'inicio';
	if (routeId.startsWith('/explorar')) return 'explorar';
	if (routeId.startsWith('/offline')) return 'offline';
	if (routeId.startsWith('/cuenta')) return 'cuenta';
	// Contacto is opened from Cuenta, so Cuenta stays marked.
	if (routeId.startsWith('/contacto')) return 'cuenta';
	return null;
}

/** Builds an href for a nav item, honouring the app base path. */
export function navHref(base: string, path: string): string {
	if (path === '/') return `${base}/`;
	return `${base}${path}`;
}
