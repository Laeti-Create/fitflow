const CACHE_NAME = "fitflow-cache-v6";

const ASSETS_TO_CACHE = [
  "/fitflow/",
  "/fitflow/index.html",
  "/fitflow/styles.css",
  "/fitflow/nutrition.css",
  "/fitflow/home-coach.css",
  "/fitflow/app.js",
  "/fitflow/nutrition.js",
  "/fitflow/home-coach.js",
  "/fitflow/firebase-config.js",
  "/fitflow/manifest.json",
  "/fitflow/icon.svg",
  "/fitflow/icon-192.png",
  "/fitflow/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/fitflow/index.html")))
  );
});
