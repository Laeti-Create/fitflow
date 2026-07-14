const FITFLOW_VERSION = "0.51.0-develop.5";
const BUILD_CHANNEL = "develop";

const STYLES = [
  "nutrition-enhancements.css",
  "running-plan.css",
  "running-guided.css",
  "meal-template-builder-v2.css"
];

const MODULES = [
  "auth-recovery.js",
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
  "food-search.js",
  "nutrition-pickers.js",
  "nutrition-live-updates.js",
  "nutrition-net-budget.js",
  "nutrition-add-menu.js",
  "barcode-scanner.js",
  "running.js",
  "running-plan.js",
  "running-plan-link.js",
  "running-guided.js",
  "running-integration.js",
  "dashboard-day-summary.js?v=22"
];

function qs(selector) {
  return document.querySelector(selector);
}

function loadStyle(path) {
  if ([...document.styleSheets].some((sheet) => sheet.href?.includes(path))) return;
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${path}?v=${FITFLOW_VERSION}`;
  document.head.appendChild(link);
}

async function loadModules() {
  for (const path of MODULES) {
    try {
      const separator = path.includes("?") ? "&" : "?";
      await import(`./${path}${separator}appv=${FITFLOW_VERSION}`);
    } catch (error) {
      console.error(`FitFlow : module non chargé (${path})`, error);
      window.dispatchEvent(new CustomEvent("fitflow:module-error", {
        detail: { path, message: error?.message || String(error) }
      }));
    }
  }
}

function removeLegacyCoachCard() {
  document.querySelectorAll("#view-dashboard .coach-card").forEach((card) => card.remove());
}

function createUpdateBanner() {
  if (qs("#fitflow-update-banner")) return qs("#fitflow-update-banner");
  const banner = document.createElement("aside");
  banner.id = "fitflow-update-banner";
  banner.className = "fitflow-update-banner";
  banner.hidden = true;
  banner.innerHTML = `
    <span>Une nouvelle version de FitFlow est disponible.</span>
    <button type="button" id="fitflow-update-now">Mettre à jour</button>
    <button type="button" id="fitflow-update-later" aria-label="Fermer">×</button>`;
  document.body.appendChild(banner);
  qs("#fitflow-update-later")?.addEventListener("click", () => { banner.hidden = true; });
  return banner;
}

async function activateWaitingWorker(registration) {
  if (!registration?.waiting) return false;
  const button = qs("#fitflow-update-now");
  if (button) {
    button.disabled = true;
    button.textContent = "Mise à jour…";
  }
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

async function setupUpdateFlow() {
  if (!("serviceWorker" in navigator)) return;
  const banner = createUpdateBanner();
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const registration = await navigator.serviceWorker.getRegistration("./");
  if (!registration) return;

  const showUpdate = () => {
    if (!registration.waiting) return false;
    banner.hidden = false;
    const button = qs("#fitflow-update-now");
    if (button) {
      button.disabled = false;
      button.textContent = "Mettre à jour";
      button.onclick = () => activateWaitingWorker(registration);
    }
    return true;
  };

  showUpdate();
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate();
    });
  });

  window.fitflowCheckForUpdates = async () => {
    await registration.update();
    await new Promise((resolve) => setTimeout(resolve, 600));
    return showUpdate();
  };
}

function diagnosticSnapshot() {
  const controller = navigator.serviceWorker?.controller;
  return {
    version: FITFLOW_VERSION,
    channel: BUILD_CHANNEL,
    online: navigator.onLine,
    url: location.href,
    standalone: window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true,
    serviceWorker: controller ? "actif" : "inactif",
    cameraApi: Boolean(navigator.mediaDevices?.getUserMedia),
    barcodeDetector: "BarcodeDetector" in window,
    notificationPermission: "Notification" in window ? Notification.permission : "non disponible",
    userAgent: navigator.userAgent,
    generatedAt: new Date().toISOString()
  };
}

async function copyDiagnostic() {
  const text = Object.entries(diagnosticSnapshot()).map(([key, value]) => `${key}: ${value}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    showShellToast("Diagnostic copié ✅");
  } catch {
    window.prompt("Copie ce diagnostic :", text);
  }
}

async function repairAppCache() {
  if (!("caches" in window)) return;
  const confirmed = window.confirm("Réparer le cache de FitFlow ? Tes données Firebase et tes données locales ne seront pas supprimées.");
  if (!confirmed) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("fitflow-cache-")).map((key) => caches.delete(key)));
  const registration = await navigator.serviceWorker?.getRegistration("./");
  await registration?.update();
  window.location.reload();
}

function showShellToast(message) {
  let toast = qs("#fitflow-shell-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "fitflow-shell-toast";
    toast.className = "fitflow-shell-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("active");
  clearTimeout(showShellToast.timer);
  showShellToast.timer = setTimeout(() => toast.classList.remove("active"), 2300);
}

function injectSettingsCards() {
  const settings = qs("#view-settings");
  if (!settings || qs("#fitflow-version-card")) return;
  const accountCard = [...settings.querySelectorAll(".settings-card")].find((card) => card.querySelector("#btn-signout"));
  if (!accountCard) return;

  const versionCard = document.createElement("article");
  versionCard.id = "fitflow-version-card";
  versionCard.className = "settings-card";
  versionCard.innerHTML = `
    <h3>Application</h3>
    <dl class="fitflow-app-info">
      <div><dt>Version</dt><dd>${FITFLOW_VERSION}</dd></div>
      <div><dt>Canal</dt><dd>${BUILD_CHANNEL}</dd></div>
      <div><dt>Connexion</dt><dd id="fitflow-network-state">${navigator.onLine ? "En ligne" : "Hors ligne"}</dd></div>
    </dl>
    <div class="fitflow-settings-actions">
      <button type="button" class="mini-action" id="fitflow-check-update">Vérifier les mises à jour</button>
    </div>`;

  const diagnosticCard = document.createElement("article");
  diagnosticCard.id = "fitflow-diagnostic-card";
  diagnosticCard.className = "settings-card";
  diagnosticCard.innerHTML = `
    <h3>Diagnostic FitFlow</h3>
    <p class="muted small">Informations techniques utiles si une fonctionnalité ne répond pas correctement.</p>
    <div class="fitflow-settings-actions">
      <button type="button" class="mini-action" id="fitflow-copy-diagnostic">Copier le diagnostic</button>
      <button type="button" class="mini-action" id="fitflow-repair-cache">Réparer le cache</button>
    </div>`;

  accountCard.insertAdjacentElement("beforebegin", versionCard);
  accountCard.insertAdjacentElement("beforebegin", diagnosticCard);

  qs("#fitflow-copy-diagnostic")?.addEventListener("click", copyDiagnostic);
  qs("#fitflow-repair-cache")?.addEventListener("click", repairAppCache);
  qs("#fitflow-check-update")?.addEventListener("click", async () => {
    const found = await window.fitflowCheckForUpdates?.();
    showShellToast(found ? "Mise à jour prête — utilise la bannière en haut" : "FitFlow est à jour ✅");
  });

  window.addEventListener("online", updateNetworkState);
  window.addEventListener("offline", updateNetworkState);
}

function updateNetworkState() {
  const state = qs("#fitflow-network-state");
  if (state) state.textContent = navigator.onLine ? "En ligne" : "Hors ligne";
  document.body.classList.toggle("fitflow-offline", !navigator.onLine);
}

function createOfflineBadge() {
  if (qs("#fitflow-offline-badge")) return;
  const badge = document.createElement("div");
  badge.id = "fitflow-offline-badge";
  badge.className = "fitflow-offline-badge";
  badge.textContent = "Hors ligne · consultation des données chargées";
  document.body.appendChild(badge);
  updateNetworkState();
}

async function init() {
  window.FITFLOW_VERSION = FITFLOW_VERSION;
  STYLES.forEach(loadStyle);
  removeLegacyCoachCard();
  createOfflineBadge();
  injectSettingsCards();
  await setupUpdateFlow();
  await loadModules();
  removeLegacyCoachCard();
  injectSettingsCards();
  window.dispatchEvent(new CustomEvent("fitflow:app-ready", { detail: { version: FITFLOW_VERSION } }));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
