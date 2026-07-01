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

async function loadTemplates() {
  if (firebase && currentUser) {
    const snap = await getDocs(query(collection(firebase.db, "users", currentUser.uid, "mealTemplates"), orderBy("name", "asc")));
    mealTemplates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } else {
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
    return { name:title, detail, calories, protein, carbs, fat, fiber };
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
  let card = qs("#meal-templates-card");
  if (card) return card;

  const favoritesCard = qs("#nutrition-favorites-card");
  const quickCard = qs("#estimated-meal-card");
  const insertAfter = favoritesCard || quickCard || qs("#nutrition-macros")?.closest(".nutrition-card");
  if (!insertAfter?.parentNode) return null;

  card = document.createElement("article");
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

function ensureTemplateModal() {
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
  overlay.querySelector(".nutrition-modal-close")?.addEventListener("click", closeTemplateBuilder);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeTemplateBuilder();
  });
  overlay.querySelector("#meal-template-form")?.addEventListener("submit", submitTemplateBuilder);
  overlay.querySelector("#template-builder-list")?.addEventListener("change", updateBuilderSummary);
  return overlay;
}

function openTemplateBuilder() {
  const overlay = ensureTemplateModal();
  const items = getDisplayedFoodItems();
  const list = qs("#template-builder-list");
  const form = qs("#meal-template-form");

  if (form) form.reset();
  if (!items.length) {
    list.innerHTML = `<p class="empty-template">Aucun aliment affiché sur cette journée. Ajoute d’abord les aliments du repas.</p>`;
  } else {
    list.innerHTML = items.map((item, index) => `
      <label class="template-builder-item">
        <input type="checkbox" name="item" value="${index}" checked />
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${fmtInt(item.calories)} kcal · P ${fmt(item.protein)} · G ${fmt(item.carbs)} · L ${fmt(item.fat)} · F ${fmt(item.fiber)}</small>
        </span>
      </label>
    `).join("");
  }

  overlay.dataset.items = JSON.stringify(items);
  overlay.classList.add("active");
  updateBuilderSummary();
}

function selectedBuilderItems() {
  const overlay = qs("#meal-template-modal");
  const items = JSON.parse(overlay?.dataset.items || "[]");
  const selected = [...document.querySelectorAll("#template-builder-list input[name='item']:checked")]
    .map((input) => items[Number(input.value)])
    .filter(Boolean);
  return selected;
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
  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Enregistrement…";
  }

  try {
    const name = new FormData(form).get("name")?.toString().trim() || "Repas type";
    const template = {
      name,
      items,
      totals: templateTotals(items)
    };
    await saveTemplate(template);
    closeTemplateBuilder();
    showToast("Repas type enregistré ✅");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original || "Enregistrer le repas type";
    }
  }
}

function closeTemplateBuilder() {
  qs("#meal-template-modal")?.classList.remove("active");
}

async function addTemplateToDay(index) {
  const template = mealTemplates[index];
  if (!template) return;

  const meal = prompt("Dans quel repas ajouter ce repas type ? breakfast, lunch, dinner ou snack", "breakfast");
  if (meal === null) return;
  const normalizedMeal = MEALS.includes(meal) ? meal : "breakfast";
  const date = qs("#nutrition-date")?.value || todayISO();

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

  showToast("Repas type ajouté ✅");
  refreshNutrition();
}

function bindTemplateEvents() {
  ensureTemplateCard();
  renderTemplates();

  document.addEventListener("click", async (event) => {
    const addButton = event.target.closest(".add-template-to-day");
    const deleteButton = event.target.closest(".delete-template");

    if (addButton) await addTemplateToDay(Number(addButton.dataset.index));
    if (deleteButton) await deleteTemplate(Number(deleteButton.dataset.index));
  });

  const observer = new MutationObserver(() => {
    ensureTemplateCard();
    renderTemplates();
  });
  const nutritionView = qs("#view-nutrition");
  if (nutritionView) observer.observe(nutritionView, { childList:true, subtree:true });
}

if (firebase) {
  onAuthStateChanged(firebase.auth, async (user) => {
    currentUser = user;
    if (user) await loadTemplates();
  });
} else {
  currentUser = { uid:"demo" };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    bindTemplateEvents();
    await loadTemplates();
  });
} else {
  bindTemplateEvents();
  await loadTemplates();
}
