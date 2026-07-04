import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
let user = null;
let cachedEntries = [];
let cacheAt = 0;
let stampTimer = null;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function saveLocal(name, value){ localStorage.setItem(key(name), JSON.stringify(value)); }
function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}
function refresh(){
  cachedEntries = [];
  cacheAt = 0;
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-data-changed"));
  window.dispatchEvent(new Event("focus"));
  setTimeout(() => window.dispatchEvent(new Event("focus")), 350);
}

async function loadEntries(force = false){
  if(!force && cachedEntries.length && Date.now() - cacheAt < 10000) return cachedEntries;
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

function stampButton(button, entry){
  if(!button || !entry?.id) return;
  button.dataset.id = entry.id;
  button.dataset.entryId = entry.id;
  button.closest(".nutrition-food-item")?.setAttribute("data-entry-id", entry.id);
}

async function stampActionIds(force = false){
  const buttons = [...document.querySelectorAll(".edit-food, .favorite-food, .delete-food")]
    .filter((button) => force || !button.dataset.id || !button.dataset.entryId);
  if(!buttons.length) return;

  try{
    const entries = await loadEntries(force);
    buttons.forEach((button) => {
      const index = Number(button.dataset.index);
      if(!Number.isFinite(index)) return;
      stampButton(button, entries[index]);
    });
  }catch(error){
    console.warn("IDs aliments non synchronisés", error);
  }
}

function requestStamp(delay = 120, force = false){
  clearTimeout(stampTimer);
  stampTimer = setTimeout(() => stampActionIds(force), delay);
}

async function handleClick(event){
  const favoriteButton = event.target.closest(".favorite-food");
  const deleteButton = event.target.closest(".delete-food");
  const button = favoriteButton || deleteButton;
  if(!button) return;

  if(!button.dataset.id && !button.dataset.entryId) await stampActionIds(false);
  const id = button.dataset.id || button.dataset.entryId;
  if(!id) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  try{
    const entry = await loadEntryById(id);
    if(!entry){ toast("Aliment introuvable"); return; }

    if(favoriteButton){
      await addFavoriteByEntry(entry);
      toast(`"${entry.name}" ajouté aux favoris ⭐`);
    }

    if(deleteButton){
      if(!confirm(`Supprimer "${entry.name}" ?`)) return;
      await deleteEntryById(id);
      toast("Aliment supprimé ✅");
    }

    refresh();
  }catch(error){
    console.warn("Action aliment par ID échouée", error);
    toast("Action impossible pour le moment");
  }
}

function init(){
  requestStamp(300, true);
  document.addEventListener("click", handleClick, true);
  window.addEventListener("focus", () => requestStamp(250));
  window.addEventListener("fitflow:nutrition-data-changed", () => requestStamp(250, true));
  window.addEventListener("fitflow:nutrition-entry-added", () => requestStamp(450, true));
  const root = qs("#view-nutrition");
  if(root) new MutationObserver(() => requestStamp(220)).observe(root, { childList:true, subtree:true });
}

if(fb){
  onAuthStateChanged(fb.auth, (u) => { user = u; init(); });
}else{
  user = { uid:"demo" };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}
