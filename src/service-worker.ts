/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = `audioguia-shell-${version}`;
const TOUR_CACHE_PREFIX = "audioguia-tour-";

const toAbsolute = (path: string) => new URL(path, self.registration.scope).href;

const shellAssets = [...build, ...files].map(toAbsolute);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(shellAssets)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith("audioguia-shell-") && key !== SHELL_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve(true);
        })
      );
      await self.clients.claim();
    })()
  );
});

async function cacheTourAssets(payload: {
  id: string;
  slug: string;
  files: string[];
  json?: string;
}) {
  const cacheName = `${TOUR_CACHE_PREFIX}${payload.id}`;
  const cache = await caches.open(cacheName);

  const urls = new Set<string>();
  for (const f of payload.files ?? []) {
    urls.add(toAbsolute(f));
  }

  await Promise.all(
    Array.from(urls).map((url) =>
      cache.add(url).catch((err) => {
        console.error("Failed to cache", url, err);
      })
    )
  );

  if (payload.json) {
    const jsonUrl = toAbsolute(`/offline/tours/${payload.slug}.json`);
    await cache.put(
      jsonUrl,
      new Response(payload.json, {
        headers: { "Content-Type": "application/json" }
      })
    );
  }

  await notifyClients({ type: "tour-downloaded", id: payload.id });
}

async function deleteTourAssets(id: string) {
  const cacheName = `${TOUR_CACHE_PREFIX}${id}`;
  await caches.delete(cacheName);
  await notifyClients({ type: "tour-deleted", id });
}

async function notifyClients(message: Record<string, unknown>) {
  const allClients = await self.clients.matchAll();
  for (const client of allClients) {
    client.postMessage(message);
  }
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "download-tour") {
    event.waitUntil(cacheTourAssets(data.payload));
  }

  if (data.type === "delete-tour") {
    event.waitUntil(deleteTourAssets(data.id));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        return response;
      } catch (err) {
        const fallback = await caches.match(request);
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});
