/*
 * AutoDM service worker: an offline fallback page, nothing more.
 *
 * - Precaches /offline (a static page with no user data), the assets it needs to render, and the
 *   app icons.
 * - Navigations are network-first; the offline page is shown ONLY when the network request fails
 *   (a 4xx/5xx response from the server is passed through unchanged).
 * - Never caches HTML pages, API responses or anything behind sign-in: nothing is ever written to the
 *   cache outside the install step.
 *
 * Bump VERSION when this file or the offline page changes so old caches are dropped on activate.
 */
const VERSION = "v2";
const CACHE_PREFIX = "autodm-";
/** Caches from before the rename (auto-reply-ig -> AutoDM); always deleted on activate. */
const LEGACY_CACHE_PREFIXES = ["auto-reply-ig-"];
const CACHE = `${CACHE_PREFIX}offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/icon.svg",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];
/** Build assets referenced by the offline page (CSS, JS chunks, fonts). Hashed, so immutable. */
const NEXT_ASSET = /(?:\/_next\/)?(static\/(?:chunks|css|media)\/[\w.~/-]+\.(?:js|css|woff2))/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // credentials: "omit" so the cached copy can never contain anything session-specific.
      const res = await fetch(OFFLINE_URL, { credentials: "omit", cache: "no-store" });
      if (!res.ok) throw new Error(`offline page: HTTP ${res.status}`);
      const html = await res.clone().text();
      await cache.put(OFFLINE_URL, res);
      const assets = new Set(STATIC_ASSETS);
      for (const match of html.matchAll(NEXT_ASSET)) assets.add(`/_next/${match[1]}`);
      // Best effort: a missing chunk only means the offline page renders without it.
      await Promise.allSettled(
        [...assets].map((url) => cache.add(new Request(url, { credentials: "omit" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith(CACHE_PREFIX) && key !== CACHE) ||
              LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
          )
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded || (await fetch(request));
        } catch {
          const offline = await caches.match(OFFLINE_URL, { cacheName: CACHE });
          return offline || Response.error();
        }
      })(),
    );
    return;
  }

  // Static files: serve from the precache when present (works offline), otherwise straight from the
  // network. Responses are never added to the cache here.
  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => (await caches.match(request, { cacheName: CACHE })) || fetch(request))());
  }
});
