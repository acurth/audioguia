import { existsSync, readFileSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * HTTPS for the dev server, when a certificate is there for it.
 *
 * Downloading a tour for offline use runs in the service worker, and a browser
 * only hands out a service worker in a secure context: https, or localhost.
 * A phone opening the dev server by its LAN address gets neither, so the whole
 * offline feature is untestable over plain http.
 *
 * The certificate is not in the repo. Make your own with mkcert, naming every
 * host you will open the app from:
 *
 *   mkdir -p certs && cd certs
 *   mkcert <your-machine>.local localhost 127.0.0.1 <your LAN IP>
 *
 * Then point these two variables at the files, or let the default below find
 * them. With no certificate the server falls back to http, unchanged.
 */
const certPath = process.env.DEV_SSL_CERT ?? 'certs/axels-macbook-pro.local+4.pem';
const keyPath = process.env.DEV_SSL_KEY ?? 'certs/axels-macbook-pro.local+4-key.pem';
const hasCert = existsSync(certPath) && existsSync(keyPath);

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true,
		...(hasCert ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {})
	}
});
