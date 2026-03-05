/* global self, caches, clients */

const SW_VERSION = "docv1-pwa-v1";
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/manifest.webmanifest", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== STATIC_CACHE && name !== RUNTIME_CACHE) {
            return caches.delete(name);
          }
          return Promise.resolve(false);
        }),
      );
      await clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

function isStaticAsset(request) {
  if (request.method !== "GET") {
    return false;
  }
  if (request.destination === "style" || request.destination === "script" || request.destination === "worker" || request.destination === "font" || request.destination === "image") {
    return true;
  }
  const { pathname } = new URL(request.url);
  return pathname.startsWith("/_next/static/");
}

async function handleNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const fallback = await caches.match(OFFLINE_URL);
    if (fallback) {
      return fallback;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  if (!isSameOrigin(request.url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(handleStatic(request));
  }
});

