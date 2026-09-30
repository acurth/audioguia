/// <reference lib="webworker" />

import { build, files, prerendered, version } from "$service-worker";

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

const shellStaticAllowlist = new Set([
  "/manifest.webmanifest",
  "/robots.txt",
  "/media/ui/tracking-on.mp3",
  "/media/ui/tracking-off.mp3"
]);
// /media/home/ holds the Inicio photos, which are part of the app shell and
// not of any single tour, so they have to survive with no signal too.
const shellStaticPrefixes = ["/branding/", "/og/", "/media/home/"];

// The cover photo of every trail is on the Explorar cards and at the top of
// Detalle. Kept with the app, so a trail that was never downloaded still shows
// its photo with no signal. About 400 KB each; the audios stay out.
const isTourCover = (relPath: string) => /^\/media\/tours\/[^/]+\/background\.webp$/.test(relPath);

const isStaticShellAsset = (url: string) => {
  const relPath = getRelativePath(url);
  if (!relPath) return false;
  if (isTourCover(relPath)) return true;
  if (relPath.startsWith("/audio/tours/")) return false;
  if (relPath.startsWith("/media/tours/")) return false;
  if (relPath.startsWith("/offline/tours/")) return false;
  if (shellStaticAllowlist.has(relPath)) return true;
  return shellStaticPrefixes.some((prefix) => relPath.startsWith(prefix));
};

// SvelteKit writes _app/env.js next to the build but leaves it out of
// `build`. Every page imports it on start, so without it the app does not
// start offline: the page shows, but nothing on it works.
const buildAssets = [...build, `${scopePath}/_app/env.js`].map(toAbsolute);
const staticShellAssets = files
  .map(toAbsolute)
  .filter(isStaticShellAsset);
const shellAssets = [...buildAssets, ...staticShellAssets].filter(isCacheableUrl);

/**
 * The key a page is saved under. The server answers /sobre, /sobre/ and
 * /sobre.html with the same page, and ?orden=cerca only changes the order in
 * Explorar, so they all share one saved copy.
 */
const pageKey = (url: string) => {
  const relPath = getRelativePath(url);
  if (relPath === null) return null;
  let path = relPath.replace(/\.html$/, "").replace(/\/+$/, "");
  if (path === "" || path === "/index") path = "/";
  return new URL(scopePath + path, self.location.origin).href;
};

// Every prerendered page: Inicio, Explorar, Offline, Sobre, Cuenta, Contacto
// and the Detalle and Recorrido pages of each published trail. They are what
// lets the app open with no signal at all.
const pageKeys = new Set(
  prerendered.map((path) => pageKey(toAbsolute(path))).filter((key): key is string => !!key)
);
const homeKey = pageKey(self.registration.scope);

// With one bar of signal a request can hang for a minute. After this long the
// saved page is shown, and the network answer, if it arrives, is saved for
// next time.
const NAVIGATION_TIMEOUT_MS = 4000;

/**
 * Safari refuses to show a page that the service worker answers with a
 * response that was redirected. A saved copy must look like a direct answer.
 */
async function withoutRedirect(response: Response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function cachePages(cache: Cache, keys: Iterable<string>) {
  const failedUrls: string[] = [];
  for (const key of keys) {
    try {
      // no-cache: ask the server, so the saved page matches this version's
      // scripts and not an older copy the browser kept.
      const response = await fetch(key, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(key, await withoutRedirect(response));
    } catch (err) {
      failedUrls.push(key);
      console.error("Failed to cache page", key, err);
    }
  }
  return failedUrls;
}

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
      await cachePages(cache, pageKeys);
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

/**
 * Pages: network first, so a deploy reaches the phone on its next visit, and
 * each fresh copy replaces the saved one. With no signal, or after
 * NAVIGATION_TIMEOUT_MS, the saved copy. A page that was never saved, such as
 * a test trail, goes to Inicio.
 */
async function handleNavigation(event: FetchEvent): Promise<Response> {
  const { request } = event;
  const key = pageKey(request.url);
  const shouldSave = !!key && pageKeys.has(key);

  const network = fetch(request).then(async (response) => {
    if (shouldSave && response.ok && response.type === "basic") {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(key!, await withoutRedirect(response.clone()));
    }
    return response;
  });
  // Keep the worker alive until the copy is saved, even when the saved page
  // was already shown because the network was slow.
  event.waitUntil(network.catch(() => undefined));

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS)
  );

  try {
    const response = await Promise.race([network, timeout]);
    if (response && response.status < 500) return response;
  } catch {
    // No network at all. Fall through to the saved copy.
  }

  // The pages load their scripts by relative paths, so a saved page only
  // works at its own address. /sendero-x/ or /sendero-x.html would look for
  // the scripts in the wrong folder. Online the server redirects these, and
  // offline this does the same. An address with no saved page goes to Inicio.
  const target = key && pageKeys.has(key) ? key : homeKey;
  if (target && (await caches.match(target))) {
    const requested = new URL(request.url);
    if (requested.origin + requested.pathname !== target) {
      return Response.redirect(target + requested.search, 302);
    }
    return (await caches.match(target))!;
  }

  // Nothing saved: the service worker was installed but never finished
  // caching. Waiting for the network is all that is left.
  return network;
}

/**
 * Everything else: the saved copy first, then the network. Scripts and styles
 * under _app/immutable have the version in their name, so a saved copy is
 * never out of date. Tour audios and photos come from the download.
 */
async function handleAsset(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(handleAsset(request));
});
