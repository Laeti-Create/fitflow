const qs = (selector) => document.querySelector(selector);

function cardOf(selector) {
  return qs(selector)?.closest("article");
}

function applyNutritionLayout() {
  const root = qs("#view-nutrition");
  if (!root) return;

  const macrosCard = cardOf("#nutrition-macros");
  const miniGrid = qs(".nutrition-mini-grid");
  const coachCard = cardOf("#nutrition-coach-list");
  const weeklyCard = qs("#weekly-trends-card");

  if (macrosCard && miniGrid && miniGrid.previousElementSibling !== macrosCard) {
    macrosCard.insertAdjacentElement("afterend", miniGrid);
  }

  if (miniGrid && coachCard && coachCard.previousElementSibling !== miniGrid) {
    miniGrid.insertAdjacentElement("afterend", coachCard);
  }

  if (weeklyCard && weeklyCard.parentNode === root && weeklyCard !== root.lastElementChild) {
    root.appendChild(weeklyCard);
  }
}

function initNutritionLayout() {
  applyNutritionLayout();
  setTimeout(applyNutritionLayout, 400);
  setTimeout(applyNutritionLayout, 1200);
  window.addEventListener("focus", () => setTimeout(applyNutritionLayout, 250));
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-nav='nutrition'], [data-open='nutrition-form'], [data-water-add], .add-template-to-day, .delete-template, .edit-food, .delete-food, .favorite-food")) {
      setTimeout(applyNutritionLayout, 450);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNutritionLayout);
} else {
  initNutritionLayout();
}
