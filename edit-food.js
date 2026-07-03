import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
const MEALS = ["breakfast", "lunch", "dinner", "snack"];
let user = null;
let editingIndex = null;
let editingEntry = null;
let cachedEntries = [];
let cacheAt = 0;
let openingToken = 0;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if (!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function localEntries(){ return JSON.parse(localStorage.getItem(key("nutritionEntries")) || "[]"); }
function saveLocalEntries(entries){ localStorage.setItem(key("nutritionEntries"), JSON.stringify(entries)); }

function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}

function refresh(){
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-data-changed"));
  window.dispatchEvent(new Event("focus"));
  setTimeout(() => window.dispatchEvent(new Event("focus")), 350);
}

async function loadEntries(force = false){
  if(!force && cachedEntries.length && Date.now() - cacheAt < 15000) return cachedEntries;
  if(fb && user){
    const snap = await getDocs(query(collection(fb.db, "users", user.uid, "nutritionEntries"), orderBy("date", "desc")));
    cachedEntries = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
  }else{
    cachedEntries = localEntries();
  }
  cacheAt = Date.now();
  return cachedEntries;
}

async function loadEntry(index){
  const cached = cachedEntries[index];
  if(cached) return cached;
  const entries = await loadEntries(true);
  return entries[index] || null;
}

function calc(raw){
  const type = raw.referenceType || "per100";
  const q = Number(raw.quantity || 0);
  const base = {
    baseCalories:Number(raw.baseCalories || 0),
    baseProtein:Number(raw.baseProtein || 0),
    baseCarbs:Number(raw.baseCarbs || 0),
    baseFat:Number(raw.baseFat || 0),
    baseFiber:Number(raw.baseFiber || 0)
  };
  if(type === "estimatedMeal" || type === "templateItem"){
    return { calories:Math.round(base.baseCalories), protein:base.baseProtein, carbs:base.baseCarbs, fat:base.baseFat, fiber:base.baseFiber };
  }
  const f = type === "portion" ? q : q / 100;
  return {
    calories:Math.round(base.baseCalories * f),
    protein:Number((base.baseProtein * f).toFixed(1)),
    carbs:Number((base.baseCarbs * f).toFixed(1)),
    fat:Number((base.baseFat * f).toFixed(1)),
    fiber:Number((base.baseFiber * f).toFixed(1))
  };
}

function payload(raw){
  const type = raw.referenceType || "per100";
  const base = {
    date:raw.date || todayISO(),
    meal:MEALS.includes(raw.meal) ? raw.meal : "breakfast",
    name:raw.name?.trim() || "Aliment",
    referenceType:type,
    quantity:Number(raw.quantity || 0),
    unit:raw.unit || (type === "portion" ? "portion" : type === "estimatedMeal" ? "repas" : "g"),
    servingName:raw.servingName?.trim() || (type === "estimatedMeal" ? "repas" : "portion"),
    baseCalories:Number(raw.baseCalories || 0),
    baseProtein:Number(raw.baseProtein || 0),
    baseCarbs:Number(raw.baseCarbs || 0),
    baseFat:Number(raw.baseFat || 0),
    baseFiber:Number(raw.baseFiber || 0),
    favorite:Boolean(editingEntry?.favorite)
  };
  return { ...base, ...calc(base) };
}

function modal(){
  let o = qs("#edit-food-modal");
  if(o) return o;
  o = document.createElement("div");
  o.id = "edit-food-modal";
  o.className = "nutrition-modal-overlay";
  o.innerHTML = `
    <section class="nutrition-modal" role="dialog" aria-modal="true">
      <div class="nutrition-modal-head"><div><h3>Modifier l’aliment</h3><p id="edit-food-status">Ajuste les champs puis enregistre.</p></div><button class="nutrition-modal-close" type="button">×</button></div>
      <form id="edit-food-form" class="form-card">
        <label>Date <input name="date" type="date" required /></label>
        <label>Repas <select name="meal"><option value="breakfast">Petit-déjeuner</option><option value="lunch">Déjeuner</option><option value="dinner">Dîner</option><option value="snack">Collation</option></select></label>
        <label>Nom <input name="name" type="text" required /></label>
        <label>Type <select name="referenceType"><option value="per100">Valeurs pour 100 g / 100 ml</option><option value="portion">Valeurs par portion</option><option value="estimatedMeal">Repas global estimé</option><option value="templateItem">Élément de repas type</option></select></label>
        <p class="estimated-note">Pour 100 g : indique la quantité consommée. Pour repas global : indique les macros finales.</p>
        <label>Quantité <input name="quantity" type="number" min="0" step="0.01" required /></label>
        <label>Unité <select name="unit"><option value="g">g</option><option value="ml">ml</option><option value="portion">portion</option><option value="barre">barre</option><option value="paquet">paquet</option><option value="sachet">sachet</option><option value="yaourt">yaourt</option><option value="pièce">pièce</option><option value="repas">repas</option></select></label>
        <label>Nom portion <input name="servingName" type="text" /></label>
        <label>Calories réf. <input name="baseCalories" type="number" min="0" step="1" required /></label>
        <label>Protéines réf. <input name="baseProtein" type="number" min="0" step="0.1" required /></label>
        <label>Glucides réf. <input name="baseCarbs" type="number" min="0" step="0.1" required /></label>
        <label>Lipides réf. <input name="baseFat" type="number" min="0" step="0.1" required /></label>
        <label>Fibres réf. <input name="baseFiber" type="number" min="0" step="0.1" required /></label>
        <button class="btn btn-primary wide" type="submit">Enregistrer les modifications</button>
      </form>
    </section>`;
  document.body.appendChild(o);
  o.querySelector(".nutrition-modal-close").addEventListener("click", () => o.classList.remove("active"));
  o.addEventListener("click", (e) => { if(e.target === o) o.classList.remove("active"); });
  o.querySelector("#edit-food-form").addEventListener("submit", saveEdit);
  return o;
}

function setFormDisabled(disabled){
  const f = qs("#edit-food-form");
  if(!f) return;
  [...f.elements].forEach((el) => { if(el.type !== "submit") el.disabled = disabled; });
  f.querySelector("button[type='submit']").disabled = disabled;
}

function fill(entry){
  const f = qs("#edit-food-form");
  f.elements.date.value = entry.date || todayISO();
  f.elements.meal.value = MEALS.includes(entry.meal) ? entry.meal : "breakfast";
  f.elements.name.value = entry.name || "Aliment";
  f.elements.referenceType.value = entry.referenceType || "per100";
  f.elements.quantity.value = entry.quantity ?? 1;
  f.elements.unit.value = entry.unit || "g";
  f.elements.servingName.value = entry.servingName || "";
  f.elements.baseCalories.value = entry.baseCalories ?? entry.calories ?? 0;
  f.elements.baseProtein.value = entry.baseProtein ?? entry.protein ?? 0;
  f.elements.baseCarbs.value = entry.baseCarbs ?? entry.carbs ?? 0;
  f.elements.baseFat.value = entry.baseFat ?? entry.fat ?? 0;
  f.elements.baseFiber.value = entry.baseFiber ?? entry.fiber ?? 0;
}

function fillLoading(){
  const f = qs("#edit-food-form");
  if(!f) return;
  f.elements.date.value = todayISO();
  f.elements.meal.value = "breakfast";
  f.elements.name.value = "Chargement…";
  f.elements.referenceType.value = "per100";
  f.elements.quantity.value = 0;
  f.elements.unit.value = "g";
  f.elements.servingName.value = "";
  f.elements.baseCalories.value = 0;
  f.elements.baseProtein.value = 0;
  f.elements.baseCarbs.value = 0;
  f.elements.baseFat.value = 0;
  f.elements.baseFiber.value = 0;
}

async function openEdit(index){
  const token = ++openingToken;
  editingIndex = index;
  editingEntry = null;
  const o = modal();
  fillLoading();
  setFormDisabled(true);
  qs("#edit-food-status").textContent = "Chargement de l’aliment…";
  o.classList.add("active");

  try{
    const entry = await loadEntry(index);
    if(token !== openingToken) return;
    if(!entry){
      toast("Aliment introuvable");
      o.classList.remove("active");
      return;
    }
    editingEntry = entry;
    fill(entry);
    setFormDisabled(false);
    qs("#edit-food-status").textContent = "Ajuste les champs puis enregistre.";
  }catch(err){
    console.warn("Chargement aliment échoué", err);
    if(token === openingToken){
      toast("Chargement impossible");
      o.classList.remove("active");
    }
  }
}

async function saveEdit(e){
  e.preventDefault();
  if(!editingEntry){ toast("Aliment encore en chargement"); return; }
  const form = e.currentTarget;
  const btn = form.querySelector("button[type='submit']");
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "Enregistrement…";
  try{
    const data = Object.fromEntries(new FormData(form).entries());
    const update = payload(data);
    if(fb && user && editingEntry?.id){
      await updateDoc(doc(fb.db, "users", user.uid, "nutritionEntries", editingEntry.id), update);
    }else{
      const entries = localEntries();
      entries[editingIndex] = { ...entries[editingIndex], ...update, updatedAt:new Date().toISOString() };
      saveLocalEntries(entries);
    }
    cachedEntries[editingIndex] = { ...editingEntry, ...update };
    qs("#edit-food-modal")?.classList.remove("active");
    toast("Aliment modifié ✅");
    refresh();
  }catch(err){
    console.warn("Modification aliment échouée", err);
    toast("Erreur pendant la modification");
  }finally{
    btn.disabled = false; btn.textContent = old;
  }
}

function bind(){
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".edit-food");
    if(!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openEdit(Number(b.dataset.index));
  }, true);
  window.addEventListener("focus", () => { if(user) loadEntries(false).catch(()=>{}); });
  window.addEventListener("fitflow:nutrition-data-changed", () => { cachedEntries = []; cacheAt = 0; });
  window.addEventListener("fitflow:nutrition-entry-added", () => { cachedEntries = []; cacheAt = 0; });
}

if(fb){ onAuthStateChanged(fb.auth, (u) => { user = u; if(user) loadEntries(true).catch(()=>{}); }); } else { user = { uid:"demo" }; }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
