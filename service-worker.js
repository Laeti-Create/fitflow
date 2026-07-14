const APP_SHELL_VERSION = "0.51.0-develop.5";
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname.endsWith("/") ? SCOPE_URL.pathname : `${SCOPE_URL.pathname}/`;
const CACHE_SCOPE = BASE_PATH.replace(/^\/+|\/+$/g, "").replaceAll("/", "-") || "root";
const CACHE_NAME = `fitflow-cache-${CACHE_SCOPE}-${APP_SHELL_VERSION}`;

const CORE_FILES = [
  "",
  "index.html",
  "styles.css",
  "nutrition.css",
  "home-coach.css",
  "app-shell.css",
  "app.js",
  "home-coach.js",
  "nutrition.js",
  "app-shell.js",
  "auth-recovery.js",
  "firebase-config.js",
  "manifest.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

const FEATURE_FILES = [
  "nutrition-enhancements.css",
  "running-plan.css",
  "running-guided.css",
  "meal-template-builder-v2.css",
  "nutrition-enhancements.js",
  "meal-templates.js",
  "meal-template-builder-v2.js",
  "nutrition-date-tools.js",
  "nutrition-id-actions.js",
  "edit-food.js",
  "water-tracker.js",
  "weekly-trends.js",
  "nutrition-layout.js",
  "edit-meal-templates.js",
  "dashboard-day-summary.js",
  "food-search.js",
  "simple-foods.js",
  "nutrition-pickers.js",
  "nutrition-live-updates.js",
  "nutrition-net-budget.js",
  "nutrition-add-menu.js",
  "barcode-scanner.js",
  "running.js",
  "running-plan.js",
  "running-plan-link.js",
  "running-guided.js",
  "running-integration.js"
];

const toScopedPath = (file) => new URL(file, self.registration.scope).pathname;
const CORE_ASSETS = CORE_FILES.map(toScopedPath);
const FEATURE_ASSETS = FEATURE_FILES.map(toScopedPath);
const INDEX_PATH = toScopedPath("index.html");
const ROOT_PATH = toScopedPath("");

function isAppNavigation(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && (url.pathname === ROOT_PATH || url.pathname === INDEX_PATH);
}

async function withAppShell(response) {
  let html = await response.text();
  html = html.replace(/\n\s*<article class="coach-card">[\s\S]*?<strong>Message du coach<\/strong>[\s\S]*?<\/article>/, "");

  if (!html.includes("app-shell.css")) {
    html = html.replace("</head>", `<link rel="stylesheet" href="app-shell.css?v=${APP_SHELL_VERSION}" /></head>`);
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
      await cache.put(INDEX_PATH, response.clone());
    }
    return withAppShell(response);
  } catch {
    const cached = await caches.match(INDEX_PATH) || await caches.match(ROOT_PATH);
    if (cached) return withAppShell(cached);
    return new Response("FitFlow est momentanément indisponible hors ligne.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request, { cache: "no-cache" })
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
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("fitflow-cache-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
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
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
