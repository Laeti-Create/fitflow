const qs = (selector) => document.querySelector(selector);

const MEAL_LABELS = {
  breakfast: "petit-déjeuner",
  lunch: "déjeuner",
  dinner: "dîner",
  snack: "collation"
};

let selectedMeal = "breakfast";
let overlay = null;
let observerStarted = false;

function ensureOverlay(){
  if(overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "nutrition-add-source-modal";
  overlay.className = "nutrition-modal-overlay";
  overlay.innerHTML = `
    <section class="nutrition-modal add-source-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head">
        <div>
          <h3 id="add-source-title">Ajouter au repas</h3>
          <p>Choisis comment ajouter ton alimentation.</p>
        </div>
        <button class="nutrition-modal-close" type="button">×</button>
      </div>
      <div class="add-source-grid">
        <button type="button" class="nutrition-quick-card" data-source="search"><span>🔎</span><span><strong>Rechercher un aliment</strong><small>Aliment simple, produit ou code-barres.</small></span><b>›</b></button>
        <button type="button" class="nutrition-quick-card" data-source="favorites"><span>⭐</span><span><strong>Mes favoris</strong><small>Choisir un ou plusieurs aliments favoris.</small></span><b>›</b></button>
        <button type="button" class="nutrition-quick-card" data-source="templates"><span>🍱</span><span><strong>Mes repas types</strong><small>Ajouter un repas déjà enregistré.</small></span><b>›</b></button>
        <button type="button" class="nutrition-quick-card" data-source="manual"><span>✍️</span><span><strong>Saisie manuelle</strong><small>Créer un aliment et saisir ses valeurs.</small></span><b>›</b></button>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  overlay.querySelector(".nutrition-modal-close").addEventListener("click", closeMenu);
  overlay.addEventListener("click", (event) => {
    if(event.target === overlay) closeMenu();
    const sourceButton = event.target.closest("[data-source]");
    if(sourceButton) chooseSource(sourceButton.dataset.source);
  });
  return overlay;
}

function closeMenu(){
  overlay?.classList.remove("active");
}

function setPickerMeal(){
  const picker = qs("#nutrition-picker-modal");
  const select = picker?.querySelector("select[name='meal']");
  if(select) select.value = selectedMeal;
}

function setSearchMeal(){
  window.fitflowPreferredNutritionMeal = selectedMeal;
  const addForm = qs("#food-add-form");
  if(addForm?.elements?.meal) addForm.elements.meal.value = selectedMeal;
}

function chooseSource(source){
  closeMenu();
  window.fitflowPreferredNutritionMeal = selectedMeal;

  if(source === "search"){
    qs("#open-food-search-modal")?.click();
    return;
  }

  if(source === "favorites"){
    qs("#open-favorites-picker")?.click();
    setTimeout(setPickerMeal, 80);
    setTimeout(setPickerMeal, 260);
    return;
  }

  if(source === "templates"){
    qs("#open-templates-picker")?.click();
    setTimeout(setPickerMeal, 80);
    setTimeout(setPickerMeal, 260);
    return;
  }

  if(source === "manual"){
    const form = qs("#nutrition-form");
    if(form?.elements?.meal) form.elements.meal.value = selectedMeal;
    qs("[data-open='nutrition-form']")?.click();
    setTimeout(() => {
      if(form?.elements?.meal) form.elements.meal.value = selectedMeal;
    }, 80);
  }
}

function openMenu(meal){
  selectedMeal = meal || "breakfast";
  window.fitflowPreferredNutritionMeal = selectedMeal;
  const modal = ensureOverlay();
  const title = qs("#add-source-title");
  if(title) title.textContent = `Ajouter au ${MEAL_LABELS[selectedMeal] || "repas"}`;
  modal.classList.add("active");
}

function clearBlockingSearchStatus(){
  const results = qs("#food-search-results");
  if(!results?.querySelector(".food-result")) return;
  results.querySelectorAll(":scope > .empty-template").forEach((status) => status.remove());
}

function startObserver(){
  if(observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => {
    clearBlockingSearchStatus();
    setSearchMeal();
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

function init(){
  ensureOverlay();
  startObserver();

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("#view-nutrition .add-to-meal");
    if(!addButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMenu(addButton.dataset.meal || "breakfast");
  }, true);

  document.addEventListener("click", (event) => {
    if(event.target.closest("[data-food-index]")){
      setTimeout(setSearchMeal, 50);
      setTimeout(setSearchMeal, 180);
    }
  });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
