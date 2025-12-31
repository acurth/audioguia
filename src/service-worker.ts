/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = `audioguia-shell-${version}`;
const TOUR_CACHE_PREFIX = "audioguia-tour-";

const scopeUrl = new URL(self.registration.scope);
const scopePath = scopeUrl.pathname.replace(/\/$/, "");

const toAbsolute = (path: string) => new URL(path, self.registration.scope).href;

const isDotfilePath = (path: string) => path.includes("/.") || path.endsWith(".htaccess");

const getRelativePath = (url: string) => {
  try {
    const target = new URL(url, self.registration.scope);
    if (target.origin !== self.location.origin) return null;
    const pathname = target.pathname;
    if (scopePath && !pathname.startsWith(scopePath)) return null;
    return scopePath ? pathname.slice(scopePath.length) || "/" : pathname;
  } catch {
    return null;
  }
};

const isCacheableUrl = (url: string) => {
  const relPath = getRelativePath(url);
  if (!relPath) return false;
  if (isDotfilePath(relPath)) return false;
  if (relPath.startsWith("/.well-known/")) return false;
  return true;
};

const shellStaticAllowlist = new Set(["/manifest.webmanifest", "/robots.txt"]);
const shellStaticPrefixes = ["/branding/", "/og/"];

const isStaticShellAsset = (url: string) => {
  const relPath = getRelativePath(url);
  if (!relPath) return false;
  if (relPath.startsWith("/audio/tours/")) return false;
  if (relPath.startsWith("/media/tours/")) return false;
  if (relPath.startsWith("/offline/tours/")) return false;
  if (shellStaticAllowlist.has(relPath)) return true;
  return shellStaticPrefixes.some((prefix) => relPath.startsWith(prefix));
};

const buildAssets = build.map(toAbsolute);
const staticShellAssets = files
  .map(toAbsolute)
  .filter(isStaticShellAsset);
const shellAssets = [...buildAssets, ...staticShellAssets].filter(isCacheableUrl);

async function logNonOkResponses(urls: string[], label: string) {
  for (const url of urls) {
    if (!isCacheableUrl(url)) continue;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        console.warn(`[sw-cache-debug] ${label} ${response.status} ${url}`);
      }
    } catch (err) {
      console.warn(`[sw-cache-debug] ${label} fetch failed ${url}`, err);
    }
  }
}

async function cacheUrlsSafely(cache: Cache, urls: string[]) {
  const failedUrls: string[] = [];
  let okCount = 0;

  for (const url of urls) {
    try {
      await cache.add(url);
      okCount += 1;
    } catch (err) {
      failedUrls.push(url);
      console.error("Failed to cache", url, err);
    }
  }

  return {
    okCount,
    failCount: failedUrls.length,
    failedUrls
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await logNonOkResponses(shellAssets, "shell");
      await cacheUrlsSafely(cache, shellAssets);
      await self.skipWaiting();
    })()
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
      await Promise.all(
        keys
          .filter((key) => key.startsWith(TOUR_CACHE_PREFIX))
          .map(async (key) => {
            const cache = await caches.open(key);
            const cachedKeys = await cache.keys();
            if (cachedKeys.length === 0) {
              return caches.delete(key);
            }
            return true;
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

  const orderedUrls: string[] = [];
  const seen = new Set<string>();
  for (const f of payload.files ?? []) {
    const url = toAbsolute(f);
    if (!isCacheableUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    orderedUrls.push(url);
  }

  const total = orderedUrls.length;
  let completed = 0;
  const failedUrls: string[] = [];

  await notifyClients({
    type: "tour-progress",
    id: payload.id,
    stage: "preparing",
    completed,
    total
  });

  if (orderedUrls.length > 0) {
    await notifyClients({
      type: "tour-progress",
      id: payload.id,
      stage: "downloading",
      completed,
      total,
      currentIndex: 1,
      currentUrl: orderedUrls[0]
    });
  }

  for (let index = 0; index < orderedUrls.length; index += 1) {
    const url = orderedUrls[index];
    const currentIndex = index + 1;

    await notifyClients({
      type: "tour-progress",
      id: payload.id,
      stage: "downloading",
      completed,
      total,
      currentIndex,
      currentUrl: url
    });

    let cached = false;
    let lastError: unknown = undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await cache.put(url, response.clone());
        cached = true;
        break;
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (cached) {
      completed += 1;
      await notifyClients({
        type: "tour-progress",
        id: payload.id,
        stage: "downloading",
        completed,
        total,
        currentIndex,
        currentUrl: url
      });
    } else {
      failedUrls.push(url);
      console.error("Failed to cache", url, lastError);
      await notifyClients({
        type: "tour-progress",
        id: payload.id,
        stage: "downloading",
        completed,
        total,
        currentIndex,
        currentUrl: url,
        error: lastError instanceof Error ? lastError.message : "Error al cachear"
      });
    }
  }

  await notifyClients({
    type: "tour-progress",
    id: payload.id,
    stage: "saving",
    completed,
    total
  });

  if (payload.json) {
    const jsonUrl = toAbsolute(`offline/tours/${payload.slug}.json`);
    try {
      await cache.put(
        jsonUrl,
        new Response(payload.json, {
          headers: { "Content-Type": "application/json" }
        })
      );
    } catch (err) {
      failedUrls.push(jsonUrl);
      console.error("Failed to cache", jsonUrl, err);
    }
  }

  await notifyClients({
    type: "tour-progress",
    id: payload.id,
    stage: "done",
    completed: total,
    total
  });

  const result = {
    okCount: completed,
    failCount: failedUrls.length,
    failedUrls
  };

  await notifyClients({ type: "tour-downloaded", id: payload.id, result });
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
    console.info("[sw-download] start tour download (user action)", data.payload?.id);
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
