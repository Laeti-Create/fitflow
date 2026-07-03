const qs = (selector) => document.querySelector(selector);
let layoutTimer = null;
let observerStarted = false;

function cardOf(selector) {
  return qs(selector)?.closest("article");
}

function moveAfter(anchor, element) {
  if (anchor && element && element.previousElementSibling !== anchor) {
    anchor.insertAdjacentElement("afterend", element);
  }
}

function requestNutritionLayout(delay = 120) {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(applyNutritionLayout, delay);
}
window.fitflowRequestNutritionLayout = requestNutritionLayout;

function hideEmptyQuickActionShell() {
  const quickActions = qs(".nutrition-quick-actions");
  if (!quickActions) return;

  document.querySelectorAll("#view-nutrition article").forEach((article) => {
    if (article.contains(quickActions)) {
      article.classList.remove("fitflow-hidden-empty-quick");
      return;
    }

    const title = article.querySelector("h3")?.textContent?.trim().toLowerCase() || "";
    const hasInteractive = article.querySelector("button, input, select, textarea, .nutrition-quick-actions, .nutrition-food-item, .favorite-item, .meal-template-card, .water-actions, .weekly-grid");
    const isEmptyQuickShell = title === "ajout rapide" && !hasInteractive;
    article.classList.toggle("fitflow-hidden-empty-quick", isEmptyQuickShell);
  });
}

function ensureDeficitCompactCard() {
  const miniGrid = qs(".nutrition-mini-grid");
  if (!miniGrid) return null;

  let card = qs("#nutrition-deficit-card");
  if (!card) {
    card = document.createElement("article");
    card.id = "nutrition-deficit-card";
    card.className = "nutrition-card nutrition-deficit-card";
    card.innerHTML = `
      <div class="deficit-compact-head">
        <div>
          <h3>Calculs déficit 🔥</h3>
          <small>Résumé des dépenses estimées du jour.</small>
        </div>
      </div>
    `;
    miniGrid.insertAdjacentElement("afterend", card);
  }

  if (!card.contains(miniGrid)) {
    card.appendChild(miniGrid);
  }

  return card;
}

function applyNutritionLayout() {
  const root = qs("#view-nutrition");
  if (!root) return;

  const todayCard = qs("#nutrition-consumed")?.closest("article");
  const macrosCard = cardOf("#nutrition-macros");
  const deficitCard = ensureDeficitCompactCard();
  const coachCard = cardOf("#nutrition-coach-list");
  const quickActions = qs(".nutrition-quick-actions");
  const foodSearchCard = qs("#food-search-card");
  const mealsCard = cardOf("#nutrition-meals");
  const favoritesCard = qs("#nutrition-favorites-card");
  const templatesCard = qs("#meal-templates-card");
  const waterCard = qs("#water-tracker-card");
  const weeklyCard = qs("#weekly-trends-card");

  let anchor = todayCard;
  moveAfter(anchor, macrosCard); anchor = macrosCard || anchor;
  moveAfter(anchor, deficitCard); anchor = deficitCard || anchor;
  moveAfter(anchor, coachCard); anchor = coachCard || anchor;
  moveAfter(anchor, quickActions); anchor = quickActions || anchor;
  moveAfter(anchor, foodSearchCard); anchor = foodSearchCard || anchor;
  moveAfter(anchor, mealsCard); anchor = mealsCard || anchor;
  moveAfter(anchor, favoritesCard); anchor = favoritesCard || anchor;
  moveAfter(anchor, templatesCard); anchor = templatesCard || anchor;
  moveAfter(anchor, waterCard); anchor = waterCard || anchor;

  if (weeklyCard && weeklyCard.parentNode === root && weeklyCard !== root.lastElementChild) {
    root.appendChild(weeklyCard);
  } else if (weeklyCard && waterCard) {
    moveAfter(waterCard, weeklyCard);
  }

  hideEmptyQuickActionShell();
}

function startObserver() {
  const root = qs("#view-nutrition");
  if (!root || observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => requestNutritionLayout(180));
  observer.observe(root, { childList:true, subtree:false });
}

function initNutritionLayout() {
  applyNutritionLayout();
  setTimeout(applyNutritionLayout, 400);
  setTimeout(() => { applyNutritionLayout(); startObserver(); }, 1200);
  window.addEventListener("focus", () => requestNutritionLayout(200));
  window.addEventListener("fitflow:nutrition-entry-added", () => requestNutritionLayout(220));
  window.addEventListener("fitflow:nutrition-data-changed", () => requestNutritionLayout(220));
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-nav='nutrition'], [data-open='nutrition-form'], [data-water-add], .add-template-to-day, .delete-template, .edit-food, .delete-food, .favorite-food, #food-search-btn, #food-barcode-btn, #open-food-search-modal, #open-favorites-picker, #open-templates-picker")) {
      requestNutritionLayout(300);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNutritionLayout);
} else {
  initNutritionLayout();
}
