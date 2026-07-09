import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
let user = null;
let cachedEntries = [];
let cacheAt = 0;
let stampTimer = null;
let initialized = false;
let observerStarted = false;

const MEAL_BY_LABEL = {
  "Petit-déjeuner":"breakfast",
  "Déjeuner":"lunch",
  "Dîner":"dinner",
  "Collation":"snack"
};

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function saveLocal(name, value){ localStorage.setItem(key(name), JSON.stringify(value)); }
function selectedDate(){ return qs("#nutrition-date")?.value || new Date().toISOString().slice(0,10); }
function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}
function notifyChanged(source = "nutrition-id-actions"){
  cachedEntries = [];
  cacheAt = 0;
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-data-changed", { detail:{ source, light:true } }));
}

async function loadEntries(force = false){
  if(!force && cachedEntries.length && Date.now() - cacheAt < 5000) return cachedEntries;
  if(fb && user){
    const snap = await getDocs(query(collection(fb.db, "users", user.uid, "nutritionEntries"), orderBy("date", "desc")));
    cachedEntries = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
  }else{
    cachedEntries = readLocal("nutritionEntries");
  }
  cacheAt = Date.now();
  return cachedEntries;
}

async function loadEntryById(id){
  const entries = await loadEntries(false);
  return entries.find((entry) => entry.id === id) || (await loadEntries(true)).find((entry) => entry.id === id) || null;
}

function buildFavoritePayload(entry){
  return {
    name:entry.name,
    referenceType:entry.referenceType || "per100",
    unit:entry.unit || (entry.referenceType === "portion" ? "portion" : "g"),
    servingName:entry.servingName || "portion",
    servingWeight:entry.servingWeight || null,
    baseCalories:Number(entry.baseCalories || 0),
    baseProtein:Number(entry.baseProtein || 0),
    baseCarbs:Number(entry.baseCarbs || 0),
    baseFat:Number(entry.baseFat || 0),
    baseFiber:Number(entry.baseFiber || 0),
    defaultQuantity:Number(entry.quantity || (entry.referenceType === "portion" ? 1 : 100))
  };
}

async function addFavoriteByEntry(entry){
  const favorite = buildFavoritePayload(entry);
  if(fb && user){
    const snap = await getDocs(query(collection(fb.db, "users", user.uid, "foodFavorites"), orderBy("name", "asc")));
    const existing = snap.docs
      .map((d) => ({ id:d.id, ...d.data() }))
      .find((item) => item.name?.toLowerCase() === favorite.name?.toLowerCase() && item.referenceType === favorite.referenceType && item.unit === favorite.unit);
    if(existing?.id){
      await updateDoc(doc(fb.db, "users", user.uid, "foodFavorites", existing.id), { ...favorite, updatedAt:serverTimestamp() });
    }else{
      await addDoc(collection(fb.db, "users", user.uid, "foodFavorites"), { ...favorite, createdAt:serverTimestamp() });
    }
    return;
  }

  const favorites = readLocal("foodFavorites");
  const existingIndex = favorites.findIndex((item) => item.name?.toLowerCase() === favorite.name?.toLowerCase() && item.referenceType === favorite.referenceType && item.unit === favorite.unit);
  if(existingIndex >= 0) favorites[existingIndex] = { ...favorites[existingIndex], ...favorite };
  else favorites.push({ ...favorite, id:crypto.randomUUID?.() || String(Date.now()) });
  favorites.sort((a,b) => a.name.localeCompare(b.name));
  saveLocal("foodFavorites", favorites);
}

async function deleteEntryById(id){
  if(fb && user){
    await deleteDoc(doc(fb.db, "users", user.uid, "nutritionEntries", id));
    return;
  }
  saveLocal("nutritionEntries", readLocal("nutritionEntries").filter((entry) => entry.id !== id));
}

function normalize(value){
  return String(value || "").trim().toLocaleLowerCase("fr-FR");
}

function mealForItem(item){
  const label = item.closest(".nutrition-meal-card")?.querySelector(".meal-head strong")?.textContent?.trim();
  return MEAL_BY_LABEL[label] || "";
}

function stampItem(item, entry){
  if(!item || !entry?.id) return;
  item.dataset.entryId = entry.id;
  item.querySelectorAll(".edit-food, .favorite-food, .delete-food").forEach((button) => {
    button.dataset.id = entry.id;
    button.dataset.entryId = entry.id;
    button.dataset.entryName = entry.name || "";
  });
}

async function stampActionIds(force = false){
  const items = [...document.querySelectorAll("#view-nutrition .nutrition-food-item")];
  if(!items.length) return;

  try{
    const entries = (await loadEntries(force)).filter((entry) => entry.date === selectedDate());
    const usedIds = new Set();

    items.forEach((item) => {
      if(!force && item.dataset.entryId) {
        usedIds.add(item.dataset.entryId);
        return;
      }

      const displayedName = normalize(item.querySelector("strong")?.textContent);
      const meal = mealForItem(item);
      const match = entries.find((entry) =>
        entry.id &&
        !usedIds.has(entry.id) &&
        entry.meal === meal &&
        normalize(entry.name) === displayedName
      );

      if(match){
        usedIds.add(match.id);
        stampItem(item, match);
      }
    });
  }catch(error){
    console.warn("IDs aliments non synchronisés", error);
  }
}

function requestStamp(delay = 80, force = false){
  clearTimeout(stampTimer);
  stampTimer = setTimeout(() => stampActionIds(force), delay);
}

function updateMealCardAfterRemoval(item){
  const card = item?.closest(".nutrition-meal-card");
  item?.remove();
  const list = card?.querySelector(".nutrition-food-list");
  if(list && !list.querySelector(".nutrition-food-item")){
    list.innerHTML = `<p class="empty-meal">Aucun aliment pour le moment.</p>`;
  }
}

async function handleClick(event){
  const favoriteButton = event.target.closest(".favorite-food");
  const deleteButton = event.target.closest(".delete-food");
  const button = favoriteButton || deleteButton;
  if(!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if(!button.dataset.entryId && !button.dataset.id) await stampActionIds(true);
  const id = button.dataset.entryId || button.dataset.id;
  if(!id){
    toast("Aliment non synchronisé. Réessaie dans une seconde.");
    requestStamp(50, true);
    return;
  }

  try{
    const entry = await loadEntryById(id);
    if(!entry){ toast("Aliment introuvable"); return; }

    if(favoriteButton){
      await addFavoriteByEntry(entry);
      toast(`"${entry.name}" ajouté aux favoris ⭐`);
      notifyChanged("favorite-added");
      return;
    }

    if(deleteButton){
      if(!confirm(`Supprimer "${entry.name}" ?`)) return;
      button.disabled = true;
      await deleteEntryById(id);
      updateMealCardAfterRemoval(button.closest(".nutrition-food-item"));
      toast("Aliment supprimé ✅");
      notifyChanged("food-deleted");
      setTimeout(() => requestStamp(80, true), 180);
    }
  }catch(error){
    console.warn("Action aliment par ID échouée", error);
    button.disabled = false;
    toast("Action impossible pour le moment");
  }
}

function init(){
  cachedEntries = [];
  cacheAt = 0;
  requestStamp(200, true);
  if(initialized) return;
  initialized = true;

  document.addEventListener("click", handleClick, true);
  window.addEventListener("focus", () => requestStamp(160, true));
  window.addEventListener("fitflow:nutrition-data-changed", () => requestStamp(140, true));
  window.addEventListener("fitflow:nutrition-entry-added", () => requestStamp(180, true));
  document.addEventListener("change", (event) => {
    if(event.target?.id === "nutrition-date") requestStamp(120, true);
  });

  const root = qs("#view-nutrition");
  if(root && !observerStarted){
    observerStarted = true;
    new MutationObserver(() => requestStamp(100, true)).observe(root, { childList:true, subtree:true });
  }
}

if(fb){
  onAuthStateChanged(fb.auth, (u) => { user = u; init(); });
}else{
  user = { uid:"demo" };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}
