const CACHE_NAME = "fitflow-cache-v44-barcode-detection-fix";

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
  "/fitflow/meal-templates.js",
  "/fitflow/nutrition-date-tools.js",
  "/fitflow/nutrition-id-actions.js",
  "/fitflow/edit-food.js",
  "/fitflow/water-tracker.js",
  "/fitflow/weekly-trends.js",
  "/fitflow/nutrition-layout.js",
  "/fitflow/edit-meal-templates.js",
  "/fitflow/dashboard-day-summary.js",
  "/fitflow/food-search.js",
  "/fitflow/simple-foods.js",
  "/fitflow/nutrition-pickers.js",
  "/fitflow/nutrition-live-updates.js",
  "/fitflow/nutrition-net-budget.js",
  "/fitflow/barcode-scanner.js",
  "/fitflow/running.js",
  "/fitflow/running-integration.js",
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
  html = html.replace(/\n\s*<article class="coach-card">[\s\S]*?<strong>Message du coach<\/strong>[\s\S]*?<\/article>/, "");

  const scripts = [
    "nutrition-enhancements.js",
    "meal-templates.js",
    "nutrition-date-tools.js",
    "nutrition-id-actions.js",
    "edit-food.js",
    "water-tracker.js",
    "weekly-trends.js",
    "nutrition-layout.js",
    "edit-meal-templates.js",
    "food-search.js",
    "nutrition-pickers.js",
    "nutrition-live-updates.js",
    "nutrition-net-budget.js",
    "barcode-scanner.js",
    "running.js",
    "running-integration.js"
  ];

  if (!html.includes("nutrition-enhancements.css")) {
    html = html.replace("</head>", '<link rel="stylesheet" href="nutrition-enhancements.css" /></head>');
  }

  scripts.forEach((script) => {
    if (!html.includes(script)) {
      html = html.replace("</body>", `<script type="module" src="${script}"></script></body>`);
    }
  });

  html = html.replace(/<script type="module" src="dashboard-day-summary\.js(\?v=[0-9]+)?"><\/script>/g, "");
  html = html.replace("</body>", '<script type="module" src="dashboard-day-summary.js?v=22"></script></body>');

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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
        return shouldEnhanceIndex(request) ? enhanceIndexResponse(response) : response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached && shouldEnhanceIndex(request)) return enhanceIndexResponse(cached);
        return cached || caches.match("/fitflow/index.html");
      })
  );
});
