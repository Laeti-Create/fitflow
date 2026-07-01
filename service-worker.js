const CACHE_NAME = "fitflow-cache-v13-safe-restore";

const ASSETS_TO_CACHE = [
  "/fitflow/",
  "/fitflow/index.html",
  "/fitflow/styles.css",
  "/fitflow/nutrition.css",
  "/fitflow/home-coach.css",
  "/fitflow/nutrition-enhancements.css",
  "/fitflow/app.js",
  "/fitflow/nutrition.js",
  "/fitflow/home-coach.js",
  "/fitflow/nutrition-enhancements.js",
  "/fitflow/firebase-config.js",
  "/fitflow/manifest.json",
  "/fitflow/icon.svg",
  "/fitflow/icon-192.png",
  "/fitflow/icon-512.png"
];

function shouldEnhanceIndex(request) {
  const url = new URL(request.url);
  return url.pathname === "/fitflow/" || url.pathname.endsWith("/fitflow/index.html");
}

async function enhanceIndexResponse(response) {
  let html = await response.text();

  if (!html.includes("nutrition-enhancements.css")) {
    html = html.replace(
      "</head>",
      '  <link rel="stylesheet" href="nutrition-enhancements.css" />\n</head>'
    );
  }

  if (!html.includes("nutrition-enhancements.js")) {
    html = html.replace(
      "</body>",
      '  <script type="module" src="nutrition-enhancements.js"></script>\n</body>'
    );
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

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
      .then(async (response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));

        if (shouldEnhanceIndex(request)) {
          return enhanceIndexResponse(response);
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached && shouldEnhanceIndex(request)) {
          return enhanceIndexResponse(cached);
        }
        return cached || caches.match("/fitflow/index.html");
      })
  );
});
