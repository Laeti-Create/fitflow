const CACHE_NAME = "fitflow-cache-v51-app-shell-3";
const APP_SHELL_VERSION = "0.51.0-develop.3";

const CORE_ASSETS = [
  "/fitflow/",
  "/fitflow/index.html",
  "/fitflow/styles.css",
  "/fitflow/nutrition.css",
  "/fitflow/home-coach.css",
  "/fitflow/app-shell.css",
  "/fitflow/app.js",
  "/fitflow/home-coach.js",
  "/fitflow/nutrition.js",
  "/fitflow/app-shell.js",
  "/fitflow/firebase-config.js",
  "/fitflow/manifest.json",
  "/fitflow/icon.svg",
  "/fitflow/icon-192.png",
  "/fitflow/icon-512.png"
];

const FEATURE_ASSETS = [
  "/fitflow/nutrition-enhancements.css",
  "/fitflow/running-plan.css",
  "/fitflow/running-guided.css",
  "/fitflow/meal-template-builder-v2.css",
  "/fitflow/nutrition-enhancements.js",
  "/fitflow/meal-templates.js",
  "/fitflow/meal-template-builder-v2.js",
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
  "/fitflow/nutrition-add-menu.js",
  "/fitflow/barcode-scanner.js",
  "/fitflow/running.js",
  "/fitflow/running-plan.js",
  "/fitflow/running-plan-link.js",
  "/fitflow/running-guided.js",
  "/fitflow/running-integration.js"
];

function isAppNavigation(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && (url.pathname === "/fitflow/" || url.pathname.endsWith("/fitflow/index.html"));
}

async function withAppShell(response) {
  let html = await response.text();
  html = html.replace(/\n\s*<article class="coach-card">[\s\S]*?<strong>Message du coach<\/strong>[\s\S]*?<\/article>/, "");

  if (!html.includes("app-shell.css")) {
    html = html.replace("</head>", '<link rel="stylesheet" href="app-shell.css" /></head>');
  }
  if (!html.includes("app-shell.js")) {
    html = html.replace("</body>", `<script type="module" src="app-shell.js?v=${APP_SHELL_VERSION}"></script></body>`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/fitflow/index.html", response.clone());
    }
    return withAppShell(response);
  } catch {
    const cached = await caches.match("/fitflow/index.html") || await caches.match("/fitflow/");
    if (cached) return withAppShell(cached);
    return new Response("FitFlow est momentanément indisponible hors ligne.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || await networkPromise || new Response("Ressource indisponible", { status: 503 });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([...CORE_ASSETS, ...FEATURE_ASSETS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("fitflow-cache-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (isAppNavigation(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
