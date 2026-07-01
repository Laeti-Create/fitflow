import { firebaseConfig } from "./firebase-config.js";

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const todayISO = () => new Date().toISOString().slice(0, 10);
const MEALS = ["breakfast", "lunch", "dinner", "snack"];

let currentUser = null;
let modalMode = "favorite";
let selectedFavorite = null;

const isConfigReady = () =>
  firebaseConfig?.apiKey &&
  !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));

const firebase = (() => {
  if (!isConfigReady()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    auth: getAuth(app),
    db: getFirestore(app)
  };
})();

function localKey(name) {
  return `fitflow:${currentUser?.uid || "demo"}:${name}`;
}

function getLocalEntries() {
  return JSON.parse(localStorage.getItem(localKey("nutritionEntries")) || "[]");
}

function saveLocalEntries(entries) {
  localStorage.setItem(localKey("nutritionEntries"), JSON.stringify(entries));
}

function readFavoriteFromDom(button) {
  const item = button.closest(".favorite-item");
  const index = Number(button.dataset.index);

  if (!item || Number.isNaN(index)) return null;

  return {
    index,
    name: item.querySelector("strong")?.textContent?.trim() || "Favori",
    defaultQuantity: 1
  };
}

function ensureModal() {
  let overlay = qs("#nutrition-enhancement-modal");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "nutrition-enhancement-modal";
  overlay.className = "nutrition-modal-overlay";
  overlay.innerHTML = `
    <section class="nutrition-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head">
        <div>
          <h3 id="nutrition-modal-title">Ajouter</h3>
          <p id="nutrition-modal-subtitle">Sélectionne le repas et la quantité.</p>
        </div>
        <button class="nutrition-modal-close" type="button" aria-label="Fermer">×</button>
      </div>

      <form id="favorite-quick-form" class="form-card">
        <label>Repas
          <select name="meal" required>
            <option value="breakfast">Petit-déjeuner</option>
            <option value="lunch">Déjeuner</option>
            <option value="dinner">Dîner</option>
            <option value="snack">Collation</option>
          </select>
        </label>
        <label>Quantité
          <input name="quantity" type="number" min="0" step="0.01" value="1" required />
        </label>
        <button class="btn btn-primary wide" type="submit">Ajouter au jour</button>
      </form>

      <form id="estimated-meal-form" class="form-card hidden">
        <p class="estimated-note">Colle ici l’estimation globale donnée par ChatGPT ou saisie manuellement. Exemple restaurant : 820 kcal, 38 g protéines, 75 g glucides, 35 g lipides.</p>
        <label>Date
          <input name="date" type="date" required />
        </label>
        <label>Repas
          <select name="meal" required>
            <option value="breakfast">Petit-déjeuner</option>
            <option value="lunch">Déjeuner</option>
            <option value="dinner">Dîner</option>
            <option value="snack">Collation</option>
          </select>
        </label>
        <label>Nom
          <input name="name" type="text" placeholder="Ex : Restaurant italien" required />
        </label>
        <label>Calories
          <input name="calories" type="number" min="0" step="1" required />
        </label>
        <label>Protéines
          <input name="protein" type="number" min="0" step="0.1" required />
        </label>
        <label>Glucides
          <input name="carbs" type="number" min="0" step="0.1" required />
        </label>
        <label>Lipides
          <input name="fat" type="number" min="0" step="0.1" required />
        </label>
        <label>Fibres
          <input name="fiber" type="number" min="0" step="0.1" value="0" />
        </label>
        <button class="btn btn-primary wide" type="submit">Enregistrer le repas global</button>
      </form>
    </section>
  `;

  document.body.appendChild(overlay);
  bindModalEvents(overlay);
  return overlay;
}

function bindModalEvents(overlay) {
  overlay.querySelector(".nutrition-modal-close")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });

  overlay.querySelector("#favorite-quick-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedFavorite) return;

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const meal = MEALS.includes(data.meal) ? data.meal : "breakfast";
    const quantity = Number(data.quantity || 1);

    const addButton = document.querySelector(`.add-favorite-to-day[data-index="${selectedFavorite.index}"]`);
    const favorite = readFavoriteFromCard(addButton);
    if (!favorite) return;

    await addNutritionEntry({
      ...favorite,
      date: qs("#nutrition-date")?.value || todayISO(),
      meal,
      quantity,
      favorite: false,
      source: "favorite"
    });

    closeModal();
    refreshNutritionScreen();
  });

  overlay.querySelector("#estimated-meal-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());

    const entry = {
      date: data.date || qs("#nutrition-date")?.value || todayISO(),
      meal: MEALS.includes(data.meal) ? data.meal : "lunch",
      name: data.name?.trim() || "Repas global estimé",
      referenceType: "estimatedMeal",
      quantity: 1,
      unit: "repas",
      servingName: "repas",
      servingWeight: null,
      baseCalories: Number(data.calories || 0),
      baseProtein: Number(data.protein || 0),
      baseCarbs: Number(data.carbs || 0),
      baseFat: Number(data.fat || 0),
      baseFiber: Number(data.fiber || 0),
      calories: Math.round(Number(data.calories || 0)),
      protein: Number(Number(data.protein || 0).toFixed(1)),
      carbs: Number(Number(data.carbs || 0).toFixed(1)),
      fat: Number(Number(data.fat || 0).toFixed(1)),
      fiber: Number(Number(data.fiber || 0).toFixed(1)),
      favorite: false,
      source: "estimatedMeal"
    };

    await addNutritionEntry(entry);
    event.currentTarget.reset();
    closeModal();
    refreshNutritionScreen();
  });
}

function readFavoriteFromCard(button) {
  if (!button) return null;
  const item = button.closest(".favorite-item");
  if (!item) return null;

  const details = item.querySelector("small")?.textContent || "";
  const name = item.querySelector("strong")?.textContent?.trim() || "Favori";
  const referenceType = details.includes("par ") ? "portion" : "per100";
  const calories = Number((details.match(/([0-9\s]+) kcal/)?.[1] || "0").replaceAll(" ", ""));
  const protein = Number((details.match(/P ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
  const carbs = Number((details.match(/G ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
  const fat = Number((details.match(/L ([0-9,.]+)/)?.[1] || "0").replace(",", "."));

  return {
    name,
    referenceType,
    unit: referenceType === "portion" ? "portion" : "g",
    servingName: referenceType === "portion" ? "portion" : "",
    servingWeight: null,
    baseCalories: calories,
    baseProtein: protein,
    baseCarbs: carbs,
    baseFat: fat,
    baseFiber: 0
  };
}

function openFavoriteModal(button) {
  const overlay = ensureModal();
  selectedFavorite = readFavoriteFromDom(button);
  modalMode = "favorite";

  qs("#nutrition-modal-title").textContent = `Ajouter ${selectedFavorite?.name || "un favori"}`;
  qs("#nutrition-modal-subtitle").textContent = "Choisis le repas et la quantité, sans fenêtre technique.";
  qs("#favorite-quick-form")?.classList.remove("hidden");
  qs("#estimated-meal-form")?.classList.add("hidden");
  qs("#favorite-quick-form select[name='meal']").value = "breakfast";
  qs("#favorite-quick-form input[name='quantity']").value = selectedFavorite?.defaultQuantity || 1;

  overlay.classList.add("active");
}

function openEstimatedMealModal() {
  const overlay = ensureModal();
  modalMode = "estimatedMeal";
  selectedFavorite = null;

  qs("#nutrition-modal-title").textContent = "Repas global estimé";
  qs("#nutrition-modal-subtitle").textContent = "Idéal restaurant : tu rentres le total calories/macros du repas.";
  qs("#favorite-quick-form")?.classList.add("hidden");
  qs("#estimated-meal-form")?.classList.remove("hidden");
  qs("#estimated-meal-form input[name='date']").value = qs("#nutrition-date")?.value || todayISO();
  qs("#estimated-meal-form select[name='meal']").value = "lunch";

  overlay.classList.add("active");
}

function closeModal() {
  qs("#nutrition-enhancement-modal")?.classList.remove("active");
}

async function addNutritionEntry(entry) {
  if (firebase && currentUser) {
    await addDoc(collection(firebase.db, "users", currentUser.uid, "nutritionEntries"), {
      ...entry,
      createdAt: serverTimestamp()
    });
    return;
  }

  const entries = getLocalEntries();
  entries.unshift({ ...entry, id: crypto.randomUUID?.() || String(Date.now()) });
  saveLocalEntries(entries);
}

function refreshNutritionScreen() {
  window.dispatchEvent(new Event("focus"));
  setTimeout(() => window.dispatchEvent(new Event("focus")), 350);
}

function ensureQuickActionCard() {
  if (qs("#estimated-meal-card")) return;
  const macroCard = qs("#nutrition-macros")?.closest(".nutrition-card");
  if (!macroCard) return;

  const card = document.createElement("article");
  card.id = "estimated-meal-card";
  card.className = "nutrition-card";
  card.innerHTML = `
    <h3>Ajout rapide</h3>
    <div class="nutrition-quick-actions">
      <button class="nutrition-quick-card" type="button" id="open-estimated-meal">
        <span>🍽️</span>
        <span>
          <strong>Repas global estimé</strong>
          <small>Restaurant, repas extérieur ou estimation ChatGPT.</small>
        </span>
        <b>›</b>
      </button>
    </div>
  `;

  macroCard.parentNode.insertBefore(card, macroCard.nextSibling);
  card.querySelector("#open-estimated-meal")?.addEventListener("click", openEstimatedMealModal);
}

function bindEnhancements() {
  ensureModal();
  ensureQuickActionCard();

  document.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest(".add-favorite-to-day");
    if (!favoriteButton) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openFavoriteModal(favoriteButton);
  }, true);

  const observer = new MutationObserver(() => ensureQuickActionCard());
  const nutritionView = qs("#view-nutrition");
  if (nutritionView) observer.observe(nutritionView, { childList:true, subtree:true });
}

if (firebase) {
  onAuthStateChanged(firebase.auth, (user) => {
    currentUser = user;
  });
} else {
  currentUser = { uid:"demo" };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindEnhancements);
} else {
  bindEnhancements();
}
