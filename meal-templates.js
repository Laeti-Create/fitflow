import { firebaseConfig } from "./firebase-config.js";

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const todayISO = () => new Date().toISOString().slice(0, 10);
const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  dinner: "Dîner",
  snack: "Collation"
};

let currentUser = null;
let mealTemplates = [];
let selectedTemplateIndex = null;
let cardCreated = false;

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

function readLocal(name) {
  return JSON.parse(localStorage.getItem(localKey(name)) || "[]");
}

function saveLocal(name, value) {
  localStorage.setItem(localKey(name), JSON.stringify(value));
}

function fmt(value, decimals = 1) {
  return Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtInt(value) {
  return Math.round(Number(value || 0)).toLocaleString("fr-FR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  let toast = qs("#nutrition-save-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "nutrition-save-toast";
    toast.className = "nutrition-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("active");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove("active"), 2200);
}

async function safeLoadTemplates() {
  try {
    if (firebase && currentUser) {
      const snap = await getDocs(query(collection(firebase.db, "users", currentUser.uid, "mealTemplates"), orderBy("name", "asc")));
      mealTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      mealTemplates = readLocal("mealTemplates");
    }
  } catch (error) {
    console.warn("Repas types non chargés :", error);
    mealTemplates = readLocal("mealTemplates");
  }
  renderTemplates();
}

async function saveTemplate(template) {
  if (firebase && currentUser) {
    const docRef = await addDoc(collection(firebase.db, "users", currentUser.uid, "mealTemplates"), {
      ...template,
      createdAt: serverTimestamp()
    });
    mealTemplates = [...mealTemplates, { ...template, id: docRef.id }].sort((a,b) => a.name.localeCompare(b.name));
  } else {
    mealTemplates = [...mealTemplates, { ...template, id: crypto.randomUUID?.() || String(Date.now()) }].sort((a,b) => a.name.localeCompare(b.name));
    saveLocal("mealTemplates", mealTemplates);
  }
  renderTemplates();
}

async function deleteTemplate(index) {
  const template = mealTemplates[index];
  if (!template) return;
  if (!confirm(`Supprimer le repas type "${template.name}" ?`)) return;

  mealTemplates.splice(index, 1);

  if (firebase && currentUser && template.id) {
    await deleteDoc(doc(firebase.db, "users", currentUser.uid, "mealTemplates", template.id));
  } else {
    saveLocal("mealTemplates", mealTemplates);
  }

  renderTemplates();
  showToast("Repas type supprimé ✅");
}

async function addNutritionEntry(entry) {
  if (firebase && currentUser) {
    await addDoc(collection(firebase.db, "users", currentUser.uid, "nutritionEntries"), {
      ...entry,
      createdAt: serverTimestamp()
    });
    return;
  }

  const entries = readLocal("nutritionEntries");
  entries.unshift({ ...entry, id: crypto.randomUUID?.() || String(Date.now()) });
  saveLocal("nutritionEntries", entries);
}

function refreshNutrition() {
  window.dispatchEvent(new Event("focus"));
  setTimeout(() => window.dispatchEvent(new Event("focus")), 350);
}

function getDisplayedFoodItems() {
  return [...document.querySelectorAll(".nutrition-food-item")].map((item) => {
    const title = item.querySelector("strong")?.textContent?.trim() || "Aliment";
    const detail = item.querySelector("small")?.textContent || "";
    const calories = Number((detail.match(/([0-9\s]+) kcal/)?.[1] || "0").replaceAll(" ", ""));
    const protein = Number((detail.match(/P ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
    const carbs = Number((detail.match(/G ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
    const fat = Number((detail.match(/L ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
    const fiber = Number((detail.match(/F ([0-9,.]+)/)?.[1] || "0").replace(",", "."));
    return { name:title, calories, protein, carbs, fat, fiber };
  }).filter((item) => item.calories || item.protein || item.carbs || item.fat || item.fiber);
}

function templateTotals(items) {
  return items.reduce((total, item) => ({
    calories: total.calories + Number(item.calories || 0),
    protein: total.protein + Number(item.protein || 0),
    carbs: total.carbs + Number(item.carbs || 0),
    fat: total.fat + Number(item.fat || 0),
    fiber: total.fiber + Number(item.fiber || 0)
  }), { calories:0, protein:0, carbs:0, fat:0, fiber:0 });
}

function ensureTemplateCard() {
  if (cardCreated && qs("#meal-templates-card")) return qs("#meal-templates-card");

  const favoritesCard = qs("#nutrition-favorites-card");
  const quickCard = qs("#estimated-meal-card");
  const insertAfter = favoritesCard || quickCard || qs("#nutrition-macros")?.closest(".nutrition-card");
  if (!insertAfter?.parentNode) return null;

  if (qs("#meal-templates-card")) {
    cardCreated = true;
    return qs("#meal-templates-card");
  }

  const card = document.createElement("article");
  card.id = "meal-templates-card";
  card.className = "nutrition-card";
  card.innerHTML = `
    <div class="favorite-head">
      <div>
        <h3>Mes repas types 🍱</h3>
        <small>Enregistre un combo complet et ajoute-le en un clic.</small>
      </div>
      <button class="mini-action" type="button" id="create-template-from-day">+ Créer</button>
    </div>
    <div id="meal-template-list" class="meal-template-list"></div>
  `;

  insertAfter.parentNode.insertBefore(card, insertAfter.nextSibling);
  card.querySelector("#create-template-from-day")?.addEventListener("click", openTemplateBuilder);
  cardCreated = true;
  return card;
}

function renderTemplates() {
  const card = ensureTemplateCard();
  const list = qs("#meal-template-list");
  if (!card || !list) return;

  list.innerHTML = mealTemplates.length
    ? mealTemplates.map((template, index) => renderTemplate(template, index)).join("")
    : `<p class="empty-template">Aucun repas type pour le moment. Commence par saisir les aliments d’un repas, puis clique sur “+ Créer”.</p>`;
}

function renderTemplate(template, index) {
  const totals = template.totals || templateTotals(template.items || []);
  const items = (template.items || []).slice(0, 4);
  const more = (template.items || []).length > 4 ? `<li>+ ${(template.items || []).length - 4} aliment(s)</li>` : "";

  return `
    <div class="meal-template-card">
      <div class="meal-template-head">
        <div>
          <strong>${escapeHtml(template.name)}</strong>
          <small>${fmtInt(totals.calories)} kcal · P ${fmt(totals.protein)} · G ${fmt(totals.carbs)} · L ${fmt(totals.fat)} · F ${fmt(totals.fiber)}</small>
        </div>
      </div>
      <ul class="meal-template-items">
        ${items.map((item) => `<li>${escapeHtml(item.name)} · ${fmtInt(item.calories)} kcal</li>`).join("")}
        ${more}
      </ul>
      <div class="meal-template-actions">
        <button class="mini-action add-template-to-day" data-index="${index}">+ Ajouter</button>
        <button class="mini-action danger delete-template" data-index="${index}">Supprimer</button>
      </div>
    </div>
  `;
}

function ensureTemplateBuilderModal() {
  let overlay = qs("#meal-template-modal");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "meal-template-modal";
  overlay.className = "nutrition-modal-overlay";
  overlay.innerHTML = `
    <section class="nutrition-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head">
        <div>
          <h3>Créer un repas type</h3>
          <p>Sélectionne les aliments affichés dans la journée et donne un nom au repas.</p>
        </div>
        <button class="nutrition-modal-close" type="button" aria-label="Fermer">×</button>
      </div>
      <form id="meal-template-form" class="form-card">
        <label>Nom du repas type
          <input name="name" type="text" placeholder="Ex : Petit-déj muffin" required />
        </label>
        <div class="meal-template-summary" id="meal-template-summary">Sélectionne au moins un aliment.</div>
        <div id="template-builder-list" class="template-builder-list"></div>
        <button class="btn btn-primary wide" type="submit">Enregistrer le repas type</button>
      </form>
    </section>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".nutrition-modal-close")?.addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  overlay.querySelector("#meal-template-form")?.addEventListener("submit", submitTemplateBuilder);
  overlay.querySelector("#template-builder-list")?.addEventListener("change", updateBuilderSummary);
  return overlay;
}

function openTemplateBuilder() {
  const overlay = ensureTemplateBuilderModal();
  const items = getDisplayedFoodItems();
  const list = qs("#template-builder-list");
  const form = qs("#meal-template-form");

  if (form) form.reset();
  list.innerHTML = items.length
    ? items.map((item, index) => `
      <label class="template-builder-item">
        <input type="checkbox" name="item" value="${index}" checked />
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${fmtInt(item.calories)} kcal · P ${fmt(item.protein)} · G ${fmt(item.carbs)} · L ${fmt(item.fat)} · F ${fmt(item.fiber)}</small>
        </span>
      </label>
    `).join("")
    : `<p class="empty-template">Aucun aliment affiché sur cette journée. Ajoute d’abord les aliments du repas.</p>`;

  overlay.dataset.items = JSON.stringify(items);
  overlay.classList.add("active");
  updateBuilderSummary();
}

function selectedBuilderItems() {
  const overlay = qs("#meal-template-modal");
  const items = JSON.parse(overlay?.dataset.items || "[]");
  return [...document.querySelectorAll("#template-builder-list input[name='item']:checked")]
    .map((input) => items[Number(input.value)])
    .filter(Boolean);
}

function updateBuilderSummary() {
  const summary = qs("#meal-template-summary");
  if (!summary) return;
  const items = selectedBuilderItems();
  const totals = templateTotals(items);
  summary.textContent = items.length
    ? `${items.length} aliment(s) · ${fmtInt(totals.calories)} kcal · P ${fmt(totals.protein)} · G ${fmt(totals.carbs)} · L ${fmt(totals.fat)} · F ${fmt(totals.fiber)}`
    : "Sélectionne au moins un aliment.";
}

async function submitTemplateBuilder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const items = selectedBuilderItems();
  if (!items.length) {
    showToast("Sélectionne au moins un aliment");
    return;
  }

  const button = form.querySelector("button[type='submit']");
  const original = button?.textContent || "Enregistrer le repas type";
  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement…";
  }

  try {
    const name = new FormData(form).get("name")?.toString().trim() || "Repas type";
    await saveTemplate({ name, items, totals: templateTotals(items) });
    qs("#meal-template-modal")?.classList.remove("active");
    showToast("Repas type enregistré ✅");
  } catch (error) {
    console.warn("Repas type non enregistré :", error);
    showToast("Erreur pendant l’enregistrement");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function ensureAddTemplateModal() {
  let overlay = qs("#add-template-modal");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "add-template-modal";
  overlay.className = "nutrition-modal-overlay";
  overlay.innerHTML = `
    <section class="nutrition-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head">
        <div>
          <h3 id="add-template-title">Ajouter un repas type</h3>
          <p>Choisis dans quel repas l’ajouter aujourd’hui.</p>
        </div>
        <button class="nutrition-modal-close" type="button" aria-label="Fermer">×</button>
      </div>
      <form id="add-template-form" class="form-card">
        <label>Repas
          <select name="meal" required>
            <option value="breakfast">Petit-déjeuner</option>
            <option value="lunch">Déjeuner</option>
            <option value="dinner">Dîner</option>
            <option value="snack">Collation</option>
          </select>
        </label>
        <button class="btn btn-primary wide" type="submit">Ajouter au jour</button>
      </form>
    </section>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".nutrition-modal-close")?.addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  overlay.querySelector("#add-template-form")?.addEventListener("submit", submitAddTemplateToDay);
  return overlay;
}

function openAddTemplateModal(index) {
  selectedTemplateIndex = index;
  const template = mealTemplates[index];
  const overlay = ensureAddTemplateModal();
  qs("#add-template-title").textContent = `Ajouter ${template?.name || "ce repas type"}`;
  overlay.classList.add("active");
}

async function submitAddTemplateToDay(event) {
  event.preventDefault();
  const template = mealTemplates[selectedTemplateIndex];
  if (!template) return;
  const form = event.currentTarget;
  const meal = new FormData(form).get("meal")?.toString() || "breakfast";
  const normalizedMeal = MEALS.includes(meal) ? meal : "breakfast";
  const date = qs("#nutrition-date")?.value || todayISO();
  const button = form.querySelector("button[type='submit']");
  const original = button?.textContent || "Ajouter au jour";

  if (button) {
    button.disabled = true;
    button.textContent = "Ajout…";
  }

  try {
    for (const item of template.items || []) {
      await addNutritionEntry({
        date,
        meal: normalizedMeal,
        name: item.name,
        referenceType: "templateItem",
        quantity: 1,
        unit: "portion",
        servingName: "portion",
        servingWeight: null,
        baseCalories: item.calories,
        baseProtein: item.protein,
        baseCarbs: item.carbs,
        baseFat: item.fat,
        baseFiber: item.fiber,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        favorite: false,
        source: "mealTemplate",
        templateName: template.name
      });
    }
    qs("#add-template-modal")?.classList.remove("active");
    showToast("Repas type ajouté ✅");
    refreshNutrition();
  } catch (error) {
    console.warn("Repas type non ajouté :", error);
    showToast("Erreur pendant l’ajout");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function bindTemplateEvents() {
  document.addEventListener("click", async (event) => {
    const createButton = event.target.closest("#create-template-from-day");
    const addButton = event.target.closest(".add-template-to-day");
    const deleteButton = event.target.closest(".delete-template");

    if (createButton) openTemplateBuilder();
    if (addButton) openAddTemplateModal(Number(addButton.dataset.index));
    if (deleteButton) await deleteTemplate(Number(deleteButton.dataset.index));
  });
}

function initMealTemplates() {
  try {
    ensureTemplateCard();
    bindTemplateEvents();
    safeLoadTemplates();
    setTimeout(() => { ensureTemplateCard(); renderTemplates(); }, 800);
    window.addEventListener("focus", () => setTimeout(() => { ensureTemplateCard(); renderTemplates(); }, 250));
  } catch (error) {
    console.warn("Module repas types désactivé sans bloquer FitFlow :", error);
  }
}

if (firebase) {
  onAuthStateChanged(firebase.auth, async (user) => {
    currentUser = user;
    await safeLoadTemplates();
  });
} else {
  currentUser = { uid:"demo" };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMealTemplates);
} else {
  initMealTemplates();
}
