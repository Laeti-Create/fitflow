import { firebaseConfig } from "./firebase-config.js";

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];
const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtNumber = (value, decimals = 1) =>
  Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const fmtInt = (value) => Math.round(Number(value || 0)).toLocaleString("fr-FR");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const isConfigReady = () =>
  firebaseConfig?.apiKey &&
  !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));

const DEFAULT_PROFILE = {
  firstname: "Laeti",
  startWeight: 105,
  targetWeight: 65,
  height: 1.63,
  startDate: "2026-01-01",
  stepLength: 0.56,
  age: 35,
  sex: "female",
  calorieTarget: 1650,
  proteinPerKg: 1.6,
  fatMin: 50,
  fiberTarget: 25,
  waterTarget: 2,
  deficitTarget: 450,
  deficitHighThreshold: 850
};

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  dinner: "Dîner",
  snack: "Collation"
};

let firebase = null;
let state = {
  user: null,
  profile: structuredClone(DEFAULT_PROFILE),
  nutritionEntries: [],
  foodFavorites: [],
  weights: [],
  walks: [],
  strengthSessions: [],
  mode: "demo"
};

function setupFirebase() {
  if (!isConfigReady()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
}

firebase = setupFirebase();

function storageKey(name) {
  const uid = state.user?.uid || "demo";
  return `fitflow:${uid}:${name}`;
}

function loadLocal() {
  state.profile = JSON.parse(localStorage.getItem(storageKey("profile")) || "null") || structuredClone(DEFAULT_PROFILE);
  state.profile = { ...DEFAULT_PROFILE, ...state.profile };
  state.nutritionEntries = JSON.parse(localStorage.getItem(storageKey("nutritionEntries")) || "null") || [];
  state.foodFavorites = JSON.parse(localStorage.getItem(storageKey("foodFavorites")) || "null") || [];
  state.weights = JSON.parse(localStorage.getItem(storageKey("weights")) || "null") || [];
  state.walks = JSON.parse(localStorage.getItem(storageKey("walks")) || "null") || [];
  state.strengthSessions = JSON.parse(localStorage.getItem(storageKey("strength")) || "null") || [];
}

function saveLocal() {
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("nutritionEntries"), JSON.stringify(state.nutritionEntries));
  localStorage.setItem(storageKey("foodFavorites"), JSON.stringify(state.foodFavorites));
}

async function loadRemote() {
  if (!firebase || !state.user) {
    loadLocal();
    return;
  }

  const uid = state.user.uid;
  const profileRef = doc(firebase.db, "users", uid, "profile", "main");
  const profileSnap = await getDoc(profileRef);
  state.profile = profileSnap.exists()
    ? { ...DEFAULT_PROFILE, ...profileSnap.data() }
    : { ...DEFAULT_PROFILE, firstname: state.user.displayName?.split(" ")?.[0] || DEFAULT_PROFILE.firstname };

  const nutritionSnap = await getDocs(query(collection(firebase.db, "users", uid, "nutritionEntries"), orderBy("date", "desc")));
  state.nutritionEntries = nutritionSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const favoritesSnap = await getDocs(query(collection(firebase.db, "users", uid, "foodFavorites"), orderBy("name", "asc")));
  state.foodFavorites = favoritesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const weightsSnap = await getDocs(query(collection(firebase.db, "users", uid, "weights"), orderBy("date", "asc")));
  state.weights = weightsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const walksSnap = await getDocs(query(collection(firebase.db, "users", uid, "walks"), orderBy("date", "desc")));
  state.walks = walksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const strengthSnap = await getDocs(query(collection(firebase.db, "users", uid, "strengthSessions"), orderBy("date", "desc")));
  state.strengthSessions = strengthSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function currentWeight() {
  const sorted = [...state.weights].sort((a,b) => b.date.localeCompare(a.date));
  return Number(sorted[0]?.weight || state.profile.startWeight || 79.5);
}

function nutritionTargets() {
  const weight = currentWeight();
  const calorieTarget = Number(state.profile.calorieTarget || DEFAULT_PROFILE.calorieTarget);
  const proteinTarget = Math.round(weight * Number(state.profile.proteinPerKg || DEFAULT_PROFILE.proteinPerKg));
  const fatMin = Number(state.profile.fatMin || DEFAULT_PROFILE.fatMin);
  const fiberTarget = Number(state.profile.fiberTarget || DEFAULT_PROFILE.fiberTarget);
  const carbTarget = Math.max(0, Math.round((calorieTarget - proteinTarget * 4 - fatMin * 9) / 4));

  return {
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatMin,
    fiberTarget,
    waterTarget: Number(state.profile.waterTarget || DEFAULT_PROFILE.waterTarget),
    deficitTarget: Number(state.profile.deficitTarget || DEFAULT_PROFILE.deficitTarget),
    deficitHighThreshold: Number(state.profile.deficitHighThreshold || DEFAULT_PROFILE.deficitHighThreshold)
  };
}

function todayEntries() {
  const dateInput = qs("#nutrition-date");
  const date = dateInput?.value || todayISO();
  return state.nutritionEntries.filter((entry) => entry.date === date);
}

function sumNutrition(entries) {
  return entries.reduce((total, entry) => ({
    calories: total.calories + Number(entry.calories || 0),
    protein: total.protein + Number(entry.protein || 0),
    carbs: total.carbs + Number(entry.carbs || 0),
    fat: total.fat + Number(entry.fat || 0),
    fiber: total.fiber + Number(entry.fiber || 0)
  }), { calories:0, protein:0, carbs:0, fat:0, fiber:0 });
}

function bmrEstimate() {
  const weight = currentWeight();
  const heightCm = Number(state.profile.height || DEFAULT_PROFILE.height) * 100;
  const age = Number(state.profile.age || DEFAULT_PROFILE.age);
  const sexOffset = state.profile.sex === "male" ? 5 : -161;
  return Math.round(10 * weight + 6.25 * heightCm - 5 * age + sexOffset);
}

function todayActivityCalories() {
  const date = qs("#nutrition-date")?.value || todayISO();
  const walkCalories = state.walks
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => sum + Number(entry.calories || 0), 0);

  const strengthCalories = state.strengthSessions
    .filter((entry) => entry.date === date)
    .reduce((sum, entry) => {
      if (entry.calories) return sum + Number(entry.calories);
      if (entry.duration) return sum + Number(entry.duration) * 4;
      return sum;
    }, 0);

  return {
    walkCalories,
    strengthCalories,
    total: walkCalories + strengthCalories
  };
}

function calcFood(raw) {
  const referenceType = raw.referenceType || "per100";
  const quantity = Number(raw.quantity || 0);
  const factor = referenceType === "portion" ? quantity : quantity / 100;

  const baseCalories = Number(raw.baseCalories || 0);
  const baseProtein = Number(raw.baseProtein || 0);
  const baseCarbs = Number(raw.baseCarbs || 0);
  const baseFat = Number(raw.baseFat || 0);
  const baseFiber = Number(raw.baseFiber || 0);

  return {
    calories: Math.round(baseCalories * factor),
    protein: Number((baseProtein * factor).toFixed(1)),
    carbs: Number((baseCarbs * factor).toFixed(1)),
    fat: Number((baseFat * factor).toFixed(1)),
    fiber: Number((baseFiber * factor).toFixed(1))
  };
}

function buildFoodPayload(raw) {
  const referenceType = raw.referenceType || "per100";
  const payload = {
    date: raw.date || todayISO(),
    meal: raw.meal || "breakfast",
    name: raw.name?.trim() || "Aliment",
    referenceType,
    quantity: Number(raw.quantity || 0),
    unit: raw.unit || (referenceType === "portion" ? "portion" : "g"),
    servingName: raw.servingName?.trim() || "portion",
    servingWeight: raw.servingWeight ? Number(raw.servingWeight) : null,
    baseCalories: Number(raw.baseCalories || 0),
    baseProtein: Number(raw.baseProtein || 0),
    baseCarbs: Number(raw.baseCarbs || 0),
    baseFat: Number(raw.baseFat || 0),
    baseFiber: Number(raw.baseFiber || 0),
    favorite: Boolean(raw.favorite)
  };

  return {
    ...payload,
    ...calcFood(payload)
  };
}

function buildFavoritePayload(entry) {
  return {
    name: entry.name,
    referenceType: entry.referenceType || "per100",
    unit: entry.unit || (entry.referenceType === "portion" ? "portion" : "g"),
    servingName: entry.servingName || "portion",
    servingWeight: entry.servingWeight || null,
    baseCalories: Number(entry.baseCalories || 0),
    baseProtein: Number(entry.baseProtein || 0),
    baseCarbs: Number(entry.baseCarbs || 0),
    baseFat: Number(entry.baseFat || 0),
    baseFiber: Number(entry.baseFiber || 0),
    defaultQuantity: Number(entry.quantity || (entry.referenceType === "portion" ? 1 : 100))
  };
}

async function addFoodFavorite(favorite) {
  const existingIndex = state.foodFavorites.findIndex((item) =>
    item.name.toLowerCase() === favorite.name.toLowerCase() &&
    item.referenceType === favorite.referenceType &&
    item.unit === favorite.unit
  );

  if (existingIndex >= 0) {
    const existing = state.foodFavorites[existingIndex];
    state.foodFavorites[existingIndex] = { ...existing, ...favorite };
    if (firebase && state.user && existing.id) {
      await updateDoc(doc(firebase.db, "users", state.user.uid, "foodFavorites", existing.id), {
        ...favorite,
        updatedAt: serverTimestamp()
      });
    } else {
      saveLocal();
    }
    return;
  }

  if (firebase && state.user) {
    const docRef = await addDoc(collection(firebase.db, "users", state.user.uid, "foodFavorites"), {
      ...favorite,
      createdAt: serverTimestamp()
    });
    state.foodFavorites = [...state.foodFavorites, { ...favorite, id: docRef.id }].sort((a,b) => a.name.localeCompare(b.name));
  } else {
    state.foodFavorites = [...state.foodFavorites, { ...favorite, id: crypto.randomUUID?.() || String(Date.now()) }].sort((a,b) => a.name.localeCompare(b.name));
    saveLocal();
  }
}

async function deleteFoodFavorite(index) {
  const favorite = state.foodFavorites[index];
  if (!favorite) return;
  if (!confirm(`Supprimer "${favorite.name}" des favoris ?`)) return;

  state.foodFavorites.splice(index, 1);

  if (firebase && state.user && favorite.id) {
    await deleteDoc(doc(firebase.db, "users", state.user.uid, "foodFavorites", favorite.id));
  } else {
    saveLocal();
  }

  renderFavorites();
}

async function addFavoriteToDay(index) {
  const favorite = state.foodFavorites[index];
  if (!favorite) return;

  const meal = prompt("Repas : breakfast, lunch, dinner ou snack", "breakfast");
  if (meal === null) return;
  const normalizedMeal = MEALS.includes(meal) ? meal : "breakfast";

  const quantity = prompt("Quantité consommée", favorite.defaultQuantity || (favorite.referenceType === "portion" ? 1 : 100));
  if (quantity === null) return;

  const raw = {
    ...favorite,
    date: qs("#nutrition-date")?.value || todayISO(),
    meal: normalizedMeal,
    quantity: Number(quantity || favorite.defaultQuantity || 1),
    favorite: false
  };

  const entry = buildFoodPayload(raw);
  await addNutritionEntry(entry);
  renderNutrition();
}

async function addNutritionEntry(entry) {
  if (firebase && state.user) {
    const docRef = await addDoc(collection(firebase.db, "users", state.user.uid, "nutritionEntries"), {
      ...entry,
      createdAt: serverTimestamp()
    });
    state.nutritionEntries = [{ ...entry, id: docRef.id }, ...state.nutritionEntries];
  } else {
    state.nutritionEntries = [{ ...entry, id: crypto.randomUUID?.() || String(Date.now()) }, ...state.nutritionEntries];
    saveLocal();
  }

  if (entry.favorite) {
    await addFoodFavorite(buildFavoritePayload(entry));
  }
}

async function updateNutritionEntry(index, updates) {
  const entry = state.nutritionEntries[index];
  if (!entry) return;

  const updated = { ...entry, ...updates };
  state.nutritionEntries[index] = updated;

  if (firebase && state.user && entry.id) {
    await updateDoc(doc(firebase.db, "users", state.user.uid, "nutritionEntries", entry.id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } else {
    saveLocal();
  }

  renderNutrition();
}

async function deleteNutritionEntry(index) {
  const entry = state.nutritionEntries[index];
  if (!entry) return;
  if (!confirm("Supprimer cet aliment ?")) return;

  state.nutritionEntries.splice(index, 1);

  if (firebase && state.user && entry.id) {
    await deleteDoc(doc(firebase.db, "users", state.user.uid, "nutritionEntries", entry.id));
  } else {
    saveLocal();
  }

  renderNutrition();
}

async function saveNutritionSettings(settings) {
  state.profile = { ...state.profile, ...settings };

  if (firebase && state.user) {
    await setDoc(doc(firebase.db, "users", state.user.uid, "profile", "main"), {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    saveLocal();
  }

  fillNutritionSettingsForm(true);
  renderNutrition();
}

function macroStatus(value, target) {
  if (!target) return "neutral";
  const ratio = value / target;
  if (ratio >= .9) return "ok";
  if (ratio >= .75) return "watch";
  if (ratio >= .6) return "low";
  return "danger";
}

function deficitStatus(deficit, targets) {
  if (deficit < 0) return "surplus";
  if (deficit >= targets.deficitHighThreshold) return "danger";
  if (deficit >= 600) return "low";
  if (deficit >= 250) return "ok";
  return "watch";
}

function statusLabel(status) {
  return {
    ok: "OK",
    watch: "À surveiller",
    low: "Attention",
    danger: "Alerte",
    surplus: "Surplus",
    neutral: "—"
  }[status] || "—";
}

function nutritionMessages(totals, targets, deficit) {
  const messages = [];
  const proteinRatio = targets.proteinTarget ? totals.protein / targets.proteinTarget : 1;
  const fiberRatio = targets.fiberTarget ? totals.fiber / targets.fiberTarget : 1;

  if (deficit >= targets.deficitHighThreshold) {
    messages.push("🚨 Déficit très important aujourd’hui. Vérifie que tu manges assez.");
  } else if (deficit >= 600) {
    messages.push("⚠️ Déficit élevé, pense à bien récupérer.");
  } else if (deficit >= 250) {
    messages.push("✅ Déficit cohérent avec ton objectif.");
  } else if (deficit < 0) {
    messages.push("ℹ️ Tu es en surplus aujourd’hui, ce n’est pas grave ponctuellement.");
  }

  if (proteinRatio < .6) {
    messages.push("🚨 Protéines trop basses pour soutenir ta récupération.");
  } else if (proteinRatio < .75) {
    messages.push("⚠️ Protéines un peu basses aujourd’hui.");
  } else if (proteinRatio < .9) {
    messages.push("🟡 Tu es presque à ton objectif protéines.");
  } else {
    messages.push("✅ Très bon apport en protéines.");
  }

  if (fiberRatio < .5) {
    messages.push("🌿 Pense à ajouter fruits, légumes, graines ou légumineuses.");
  } else if (fiberRatio < .7) {
    messages.push("⚠️ Fibres un peu basses aujourd’hui.");
  } else if (fiberRatio < .9) {
    messages.push("🟡 Fibres presque atteintes.");
  }

  if (totals.fat < targets.fatMin * .65) {
    messages.push("⚠️ Lipides très bas, pense à ajouter une source de bons gras.");
  } else if (totals.fat < targets.fatMin * .85) {
    messages.push("🟡 Lipides un peu bas aujourd’hui.");
  }

  return messages.slice(0, 4);
}

function progressWidth(value, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, (value / target) * 100));
}

function renderMacroRow(container, label, value, target, unit, status) {
  const row = document.createElement("div");
  row.className = `macro-row ${status}`;
  row.innerHTML = `
    <div class="macro-row-head">
      <strong>${label}</strong>
      <span>${fmtNumber(value, 1)} / ${fmtNumber(target, 0)} ${unit}</span>
    </div>
    <div class="macro-progress"><div style="width:${progressWidth(value, target)}%"></div></div>
    <small>${statusLabel(status)}</small>
  `;
  container.appendChild(row);
}

function renderNutrition() {
  const root = qs("#view-nutrition");
  if (!root) return;

  const entries = todayEntries();
  const totals = sumNutrition(entries);
  const targets = nutritionTargets();
  const bmr = bmrEstimate();
  const activity = todayActivityCalories();
  const totalBurned = bmr + activity.total;
  const deficit = totalBurned - totals.calories;
  const caloriesLeft = targets.calorieTarget - totals.calories;

  qs("#nutrition-consumed").textContent = fmtInt(totals.calories);
  qs("#nutrition-target").textContent = fmtInt(targets.calorieTarget);
  qs("#nutrition-left").textContent = `${caloriesLeft >= 0 ? "Restant" : "Dépassé"} : ${fmtInt(Math.abs(caloriesLeft))} kcal`;
  qs("#nutrition-calorie-progress").style.width = `${progressWidth(totals.calories, targets.calorieTarget)}%`;

  const deficitEl = qs("#nutrition-deficit");
  const deficitState = deficitStatus(deficit, targets);
  deficitEl.textContent = `${deficit >= 0 ? "-" : "+"}${fmtInt(Math.abs(deficit))} kcal`;
  deficitEl.className = `deficit-value ${deficitState}`;
  qs("#nutrition-bmr").textContent = `${fmtInt(bmr)} kcal`;
  qs("#nutrition-activity").textContent = `${fmtInt(activity.total)} kcal`;
  qs("#nutrition-burned").textContent = `${fmtInt(totalBurned)} kcal`;

  const macroContainer = qs("#nutrition-macros");
  macroContainer.innerHTML = "";
  renderMacroRow(macroContainer, "Protéines", totals.protein, targets.proteinTarget, "g", macroStatus(totals.protein, targets.proteinTarget));
  renderMacroRow(macroContainer, "Glucides", totals.carbs, targets.carbTarget, "g", "neutral");
  renderMacroRow(macroContainer, "Lipides", totals.fat, targets.fatMin, "g", totals.fat >= targets.fatMin * .85 ? "ok" : totals.fat >= targets.fatMin * .65 ? "watch" : "low");
  renderMacroRow(macroContainer, "Fibres", totals.fiber, targets.fiberTarget, "g", macroStatus(totals.fiber, targets.fiberTarget));

  const coachList = qs("#nutrition-coach-list");
  coachList.innerHTML = nutritionMessages(totals, targets, deficit)
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join("");

  renderFavorites();
  renderMeals(entries);
}

function ensureFavoritesCard() {
  let card = qs("#nutrition-favorites-card");
  if (card) return card;

  const mealsCard = qs("#nutrition-meals")?.closest(".nutrition-card");
  if (!mealsCard) return null;

  card = document.createElement("article");
  card.id = "nutrition-favorites-card";
  card.className = "nutrition-card";
  card.innerHTML = `
    <div class="favorite-head">
      <div>
        <h3>Mes favoris ⭐</h3>
        <small>Ajoute rapidement tes aliments fréquents.</small>
      </div>
    </div>
    <div id="nutrition-favorites-list" class="favorite-list"></div>
  `;
  mealsCard.parentNode.insertBefore(card, mealsCard);
  return card;
}

function renderFavorites() {
  const card = ensureFavoritesCard();
  const container = qs("#nutrition-favorites-list");
  if (!card || !container) return;

  container.innerHTML = state.foodFavorites.length
    ? state.foodFavorites.map((favorite, index) => renderFavoriteItem(favorite, index)).join("")
    : `<p class="empty-favorite">Aucun favori pour le moment. Coche “Ajouter à mes favoris” lors de la saisie d’un aliment.</p>`;
}

function renderFavoriteItem(favorite, index) {
  const baseLabel = favorite.referenceType === "portion"
    ? `par ${favorite.servingName || favorite.unit || "portion"}`
    : `pour 100 ${favorite.unit || "g"}`;

  return `
    <div class="favorite-item">
      <div>
        <strong>${escapeHtml(favorite.name)}</strong>
        <small>${baseLabel} · ${fmtInt(favorite.baseCalories)} kcal · P ${fmtNumber(favorite.baseProtein, 1)} · G ${fmtNumber(favorite.baseCarbs, 1)} · L ${fmtNumber(favorite.baseFat, 1)}</small>
      </div>
      <div class="favorite-actions">
        <button class="mini-action add-favorite-to-day" data-index="${index}">+ Ajouter</button>
        <button class="mini-action danger delete-favorite" data-index="${index}">Supprimer</button>
      </div>
    </div>
  `;
}

function renderMeals(entries) {
  const container = qs("#nutrition-meals");
  if (!container) return;
  container.innerHTML = "";

  MEALS.forEach((meal) => {
    const mealEntries = entries.filter((entry) => entry.meal === meal);
    const totals = sumNutrition(mealEntries);
    const card = document.createElement("article");
    card.className = "nutrition-meal-card";
    card.innerHTML = `
      <div class="meal-head">
        <div>
          <strong>${MEAL_LABELS[meal]}</strong>
          <small>${fmtInt(totals.calories)} kcal · P ${fmtNumber(totals.protein, 1)} · G ${fmtNumber(totals.carbs, 1)} · L ${fmtNumber(totals.fat, 1)}</small>
        </div>
        <button class="mini-action add-to-meal" data-meal="${meal}">+ Ajouter</button>
      </div>
      <div class="nutrition-food-list">
        ${mealEntries.length ? mealEntries.map((entry) => renderFoodItem(entry)).join("") : `<p class="empty-meal">Aucun aliment pour le moment.</p>`}
      </div>
    `;
    container.appendChild(card);
  });
}

function entryDisplayQuantity(entry) {
  if (entry.referenceType === "portion") {
    const label = entry.unit && entry.unit !== "portion" ? entry.unit : entry.servingName || "portion";
    return `${fmtNumber(entry.quantity, entry.quantity % 1 ? 1 : 0)} ${label}`;
  }
  return `${fmtNumber(entry.quantity, entry.quantity % 1 ? 1 : 0)} ${entry.unit || "g"}`;
}

function renderFoodItem(entry) {
  const realIndex = state.nutritionEntries.findIndex((item) => item === entry);
  return `
    <div class="nutrition-food-item">
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${entryDisplayQuantity(entry)} · ${fmtInt(entry.calories)} kcal · P ${fmtNumber(entry.protein, 1)} · G ${fmtNumber(entry.carbs, 1)} · L ${fmtNumber(entry.fat, 1)} · F ${fmtNumber(entry.fiber, 1)}</small>
      </div>
      <div class="card-actions">
        <button class="mini-action edit-food" data-index="${realIndex}">Modifier</button>
        <button class="mini-action favorite-food" data-index="${realIndex}">Favori</button>
        <button class="mini-action danger delete-food" data-index="${realIndex}">Supprimer</button>
      </div>
    </div>
  `;
}

function toggleReferenceFields() {
  const form = qs("#nutrition-form");
  if (!form) return;
  const type = form.elements.referenceType.value;
  qsa(".portion-field").forEach((el) => el.classList.toggle("hidden", type !== "portion"));
  qs("#nutrition-reference-help").textContent = type === "portion"
    ? "Les valeurs ci-dessous correspondent à 1 portion. La quantité consommée multiplie cette portion."
    : "Les valeurs ci-dessous correspondent à 100 g ou 100 ml. FitFlow calcule selon la quantité consommée.";
}

function fillNutritionSettingsForm(force = false) {
  const form = qs("#nutrition-settings-form");
  if (!form || (form.dataset.loaded && !force)) return;

  form.elements.age.value = state.profile.age || DEFAULT_PROFILE.age;
  form.elements.calorieTarget.value = state.profile.calorieTarget || DEFAULT_PROFILE.calorieTarget;
  form.elements.proteinPerKg.value = state.profile.proteinPerKg || DEFAULT_PROFILE.proteinPerKg;
  form.elements.fatMin.value = state.profile.fatMin || DEFAULT_PROFILE.fatMin;
  form.elements.fiberTarget.value = state.profile.fiberTarget || DEFAULT_PROFILE.fiberTarget;
  form.elements.waterTarget.value = state.profile.waterTarget || DEFAULT_PROFILE.waterTarget;
  form.elements.deficitTarget.value = state.profile.deficitTarget || DEFAULT_PROFILE.deficitTarget;
  form.elements.deficitHighThreshold.value = state.profile.deficitHighThreshold || DEFAULT_PROFILE.deficitHighThreshold;
  form.dataset.loaded = "true";
}

function prefillNutritionForm(meal = "breakfast") {
  const form = qs("#nutrition-form");
  if (!form) return;
  form.elements.date.value = qs("#nutrition-date")?.value || todayISO();
  form.elements.meal.value = meal;
  toggleReferenceFields();
}

function promptValue(label, value) {
  const next = prompt(label, value ?? "");
  if (next === null) return null;
  return next;
}

async function editFood(index) {
  const entry = state.nutritionEntries[index];
  if (!entry) return;

  const raw = {
    date: promptValue("Date", entry.date),
    meal: promptValue("Repas : breakfast, lunch, dinner ou snack", entry.meal),
    name: promptValue("Nom de l'aliment", entry.name),
    referenceType: promptValue("Type : per100 ou portion", entry.referenceType || "per100"),
    quantity: promptValue("Quantité consommée", entry.quantity),
    unit: promptValue("Unité affichée", entry.unit || "g"),
    servingName: promptValue("Nom de portion", entry.servingName || "portion"),
    servingWeight: promptValue("Poids d'une portion, optionnel", entry.servingWeight || ""),
    baseCalories: promptValue("Calories de référence", entry.baseCalories),
    baseProtein: promptValue("Protéines de référence", entry.baseProtein),
    baseCarbs: promptValue("Glucides de référence", entry.baseCarbs),
    baseFat: promptValue("Lipides de référence", entry.baseFat),
    baseFiber: promptValue("Fibres de référence", entry.baseFiber)
  };

  if (Object.values(raw).some((value) => value === null)) return;

  const payload = buildFoodPayload(raw);
  await updateNutritionEntry(index, payload);
}

async function addExistingEntryToFavorites(index) {
  const entry = state.nutritionEntries[index];
  if (!entry) return;
  await addFoodFavorite(buildFavoritePayload(entry));
  renderFavorites();
  alert(`"${entry.name}" ajouté aux favoris ⭐`);
}

function bindNutritionEvents() {
  const dateInput = qs("#nutrition-date");
  if (dateInput) {
    dateInput.value = todayISO();
    dateInput.addEventListener("change", renderNutrition);
  }

  qsa("[data-open-nutrition-form]").forEach((button) => {
    button.addEventListener("click", () => {
      prefillNutritionForm(button.dataset.meal || "breakfast");
    });
  });

  qs("#view-nutrition")?.addEventListener("click", async (event) => {
    const addButton = event.target.closest(".add-to-meal");
    const editButton = event.target.closest(".edit-food");
    const favoriteButton = event.target.closest(".favorite-food");
    const deleteButton = event.target.closest(".delete-food");
    const addFavoriteButton = event.target.closest(".add-favorite-to-day");
    const deleteFavoriteButton = event.target.closest(".delete-favorite");

    if (addButton) {
      prefillNutritionForm(addButton.dataset.meal || "breakfast");
      qs("[data-open='nutrition-form']")?.click();
    }
    if (editButton) await editFood(Number(editButton.dataset.index));
    if (favoriteButton) await addExistingEntryToFavorites(Number(favoriteButton.dataset.index));
    if (deleteButton) await deleteNutritionEntry(Number(deleteButton.dataset.index));
    if (addFavoriteButton) await addFavoriteToDay(Number(addFavoriteButton.dataset.index));
    if (deleteFavoriteButton) await deleteFoodFavorite(Number(deleteFavoriteButton.dataset.index));
  });

  const form = qs("#nutrition-form");
  if (form) {
    form.elements.date.value = todayISO();
    form.elements.referenceType.addEventListener("change", toggleReferenceFields);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      raw.favorite = form.elements.favorite?.checked || false;
      const entry = buildFoodPayload(raw);
      await addNutritionEntry(entry);
      form.reset();
      form.elements.date.value = qs("#nutrition-date")?.value || todayISO();
      form.elements.referenceType.value = "per100";
      toggleReferenceFields();
      qs("[data-nav='nutrition']")?.click();
      renderNutrition();
    });
    toggleReferenceFields();
  }

  const settingsForm = qs("#nutrition-settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(settingsForm).entries());
      await saveNutritionSettings({
        age: Number(raw.age || DEFAULT_PROFILE.age),
        calorieTarget: Number(raw.calorieTarget || DEFAULT_PROFILE.calorieTarget),
        proteinPerKg: Number(raw.proteinPerKg || DEFAULT_PROFILE.proteinPerKg),
        fatMin: Number(raw.fatMin || DEFAULT_PROFILE.fatMin),
        fiberTarget: Number(raw.fiberTarget || DEFAULT_PROFILE.fiberTarget),
        waterTarget: Number(raw.waterTarget || DEFAULT_PROFILE.waterTarget),
        deficitTarget: Number(raw.deficitTarget || DEFAULT_PROFILE.deficitTarget),
        deficitHighThreshold: Number(raw.deficitHighThreshold || DEFAULT_PROFILE.deficitHighThreshold)
      });
      alert("Objectifs nutrition enregistrés ✅");
    });
  }
}

async function refreshNutritionData() {
  await loadRemote();
  fillNutritionSettingsForm(true);
  renderNutrition();
}

function initNutrition() {
  bindNutritionEvents();

  if (!firebase) {
    state.mode = "demo";
    state.user = { uid:"demo" };
    loadLocal();
    fillNutritionSettingsForm(true);
    renderNutrition();
    return;
  }

  onAuthStateChanged(firebase.auth, async (user) => {
    state.user = user;
    state.mode = user ? "firebase" : "demo";
    if (user) {
      await refreshNutritionData();
    }
  });

  window.addEventListener("focus", () => {
    if (state.user) refreshNutritionData();
  });
}

initNutrition();
