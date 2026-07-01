import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let user = null;
let selectedProduct = null;
let manualBarcode = "";

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function n(v){ return Number(v || 0); }
function fmt(v){ return Math.round(n(v)).toLocaleString("fr-FR"); }
function toast(msg){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("active"); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}

function nutriments(p){ return p?.nutriments || {}; }
function productName(p){ return p?.product_name_fr || p?.product_name || p?.generic_name_fr || p?.generic_name || "Produit"; }
function brand(p){ return p?.brands ? ` · ${p.brands}` : ""; }
function toFood(p){
  const nu = nutriments(p);
  return { name:productName(p), brand:brand(p), calories:n(nu["energy-kcal_100g"] ?? nu["energy-kcal"]), protein:n(nu.proteins_100g), carbs:n(nu.carbohydrates_100g), fat:n(nu.fat_100g), fiber:n(nu.fiber_100g), barcode:p.code || p._id || "" };
}

function ensureCard(){
  let card = qs("#food-search-card");
  if(card) return card;
  const macro = qs("#nutrition-macros")?.closest(".nutrition-card");
  if(!macro?.parentNode) return null;
  card = document.createElement("article");
  card.id = "food-search-card";
  card.className = "nutrition-card food-search-card";
  card.innerHTML = `<div class="row between"><div><h3>Recherche aliment 🔎</h3><small>Trouve un produit via Open Food Facts.</small></div></div><div class="food-search-form"><input id="food-search-text" type="search" placeholder="Ex : skyr, pain complet, barre protéinée…" /><button id="food-search-btn" class="mini-action" type="button">Rechercher</button></div><div class="food-search-form"><input id="food-barcode-text" type="text" inputmode="numeric" placeholder="Code-barres" /><button id="food-barcode-btn" class="mini-action" type="button">Code</button></div><div id="food-search-results" class="food-search-results"></div>`;
  macro.insertAdjacentElement("afterend", card);
  bindCard(card);
  return card;
}

function resultHtml(food, index){
  return `<button class="food-result" type="button" data-food-index="${index}"><strong>${food.name}</strong><small>${food.brand || ""}</small><span>${fmt(food.calories)} kcal · P ${food.protein.toFixed(1)} · G ${food.carbs.toFixed(1)} · L ${food.fat.toFixed(1)} · F ${food.fiber.toFixed(1)} /100g</span></button>`;
}

function notFoundHtml(code){
  return `<p class="empty-template">Produit non trouvé ou valeurs nutritionnelles manquantes.</p><button class="mini-action wide" type="button" id="manual-product-btn" data-barcode="${code}">Ajouter manuellement ce produit</button>`;
}

async function searchByText(){
  const q = qs("#food-search-text")?.value?.trim();
  if(!q){ toast("Tape un aliment à rechercher"); return; }
  const box = qs("#food-search-results");
  box.innerHTML = `<p class="empty-template">Recherche en cours…</p>`;
  try{
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,product_name_fr,generic_name,generic_name_fr,brands,nutriments`;
    const data = await fetch(url).then((r) => r.json());
    const foods = (data.products || []).map(toFood).filter((f) => f.calories || f.protein || f.carbs || f.fat);
    box.dataset.foods = JSON.stringify(foods);
    box.innerHTML = foods.length ? foods.map(resultHtml).join("") : `<p class="empty-template">Aucun produit exploitable trouvé.</p>`;
  }catch(e){ console.warn(e); box.innerHTML = `<p class="empty-template">Recherche indisponible pour le moment.</p>`; }
}

async function searchByBarcode(){
  const code = qs("#food-barcode-text")?.value?.replace(/\D/g, "");
  if(!code){ toast("Entre un code-barres"); return; }
  const box = qs("#food-search-results");
  box.innerHTML = `<p class="empty-template">Recherche du code-barres…</p>`;
  try{
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_fr,generic_name,generic_name_fr,brands,nutriments`;
    const data = await fetch(url).then((r) => r.json());
    const foods = data.status === 1 ? [toFood(data.product)].filter((f) => f.calories || f.protein || f.carbs || f.fat) : [];
    box.dataset.foods = JSON.stringify(foods);
    box.innerHTML = foods.length ? foods.map(resultHtml).join("") : notFoundHtml(code);
  }catch(e){ console.warn(e); box.innerHTML = `<p class="empty-template">Recherche code-barres indisponible.</p>${notFoundHtml(code)}`; }
}

function ensureModal(){
  let o = qs("#food-add-modal");
  if(o) return o;
  o = document.createElement("div");
  o.id = "food-add-modal";
  o.className = "nutrition-modal-overlay";
  o.innerHTML = `<section class="nutrition-modal" role="dialog" aria-modal="true"><div class="nutrition-modal-head"><div><h3 id="food-add-title">Ajouter l’aliment</h3><p id="food-add-subtitle">Valeurs pour 100 g.</p></div><button class="nutrition-modal-close" type="button">×</button></div><form id="food-add-form" class="form-card"><label class="manual-only hidden">Nom du produit <input name="manualName" type="text" placeholder="Ex : yaourt vanille" /></label><label>Repas <select name="meal"><option value="breakfast">Petit-déjeuner</option><option value="lunch">Déjeuner</option><option value="dinner">Dîner</option><option value="snack" selected>Collation</option></select></label><label>Quantité consommée en g/ml <input name="quantity" type="number" min="0" step="1" value="100" required /></label><div class="manual-only hidden"><label>Calories pour 100 g <input name="calories" type="number" min="0" step="1" /></label><label>Protéines pour 100 g <input name="protein" type="number" min="0" step="0.1" /></label><label>Glucides pour 100 g <input name="carbs" type="number" min="0" step="0.1" /></label><label>Lipides pour 100 g <input name="fat" type="number" min="0" step="0.1" /></label><label>Fibres pour 100 g <input name="fiber" type="number" min="0" step="0.1" /></label></div><button class="btn btn-primary wide" type="submit">Ajouter au jour</button></form></section>`;
  document.body.appendChild(o);
  o.querySelector(".nutrition-modal-close").addEventListener("click", () => o.classList.remove("active"));
  o.addEventListener("click", (e) => { if(e.target === o) o.classList.remove("active"); });
  o.querySelector("#food-add-form").addEventListener("submit", addSelectedFood);
  return o;
}

function setManualMode(isManual){
  document.querySelectorAll("#food-add-modal .manual-only").forEach((el) => el.classList.toggle("hidden", !isManual));
  qs("#food-add-title").textContent = isManual ? "Ajouter un produit manuel" : "Ajouter l’aliment";
}

function openAdd(index){
  const foods = JSON.parse(qs("#food-search-results")?.dataset.foods || "[]");
  selectedProduct = foods[index];
  manualBarcode = "";
  if(!selectedProduct) return;
  const o = ensureModal();
  setManualMode(false);
  qs("#food-add-subtitle").textContent = `${selectedProduct.name} · ${fmt(selectedProduct.calories)} kcal /100g`;
  o.classList.add("active");
}

function openManual(code){
  selectedProduct = null;
  manualBarcode = code || "";
  const o = ensureModal();
  const form = qs("#food-add-form");
  form.reset();
  form.elements.quantity.value = 100;
  setManualMode(true);
  qs("#food-add-subtitle").textContent = code ? `Code-barres conservé : ${code}` : "Saisie manuelle complète.";
  o.classList.add("active");
}

function manualProductFromForm(form){
  return { name:form.elements.manualName.value.trim() || "Produit manuel", brand:"", calories:n(form.elements.calories.value), protein:n(form.elements.protein.value), carbs:n(form.elements.carbs.value), fat:n(form.elements.fat.value), fiber:n(form.elements.fiber.value), barcode:manualBarcode };
}

function buildEntry(food, quantity, mealValue){
  const factor = n(quantity) / 100;
  return { date:qs("#nutrition-date")?.value || todayISO(), meal:mealValue || "snack", name:food.name, referenceType:"per100", quantity:n(quantity), unit:"g", servingName:"portion", servingWeight:null, baseCalories:food.calories, baseProtein:food.protein, baseCarbs:food.carbs, baseFat:food.fat, baseFiber:food.fiber, favorite:false, calories:Math.round(food.calories * factor), protein:Number((food.protein * factor).toFixed(1)), carbs:Number((food.carbs * factor).toFixed(1)), fat:Number((food.fat * factor).toFixed(1)), fiber:Number((food.fiber * factor).toFixed(1)), source:food.barcode ? "manualBarcodeOrOpenFoodFacts" : "manualFood", barcode:food.barcode || "" };
}

async function addEntry(entry){
  if(fb && user) await addDoc(collection(fb.db, "users", user.uid, "nutritionEntries"), { ...entry, createdAt:serverTimestamp() });
  else { const arr = JSON.parse(localStorage.getItem(key("nutritionEntries")) || "[]"); arr.unshift({ ...entry, id:crypto.randomUUID?.() || String(Date.now()) }); localStorage.setItem(key("nutritionEntries"), JSON.stringify(arr)); }
}

async function addSelectedFood(e){
  e.preventDefault();
  const form = e.currentTarget;
  const food = selectedProduct || manualProductFromForm(form);
  const quantity = n(form.elements.quantity.value);
  if(!quantity){ toast("Quantité invalide"); return; }
  if(!food.calories && !food.protein && !food.carbs && !food.fat){ toast("Ajoute au moins des valeurs nutritionnelles"); return; }
  const entry = buildEntry(food, quantity, form.elements.meal.value);
  const btn = form.querySelector("button[type='submit']");
  const old = btn.textContent; btn.disabled = true; btn.textContent = "Ajout…";
  try{ await addEntry(entry); qs("#food-add-modal")?.classList.remove("active"); toast("Aliment ajouté ✅"); window.dispatchEvent(new Event("focus")); }
  catch(err){ console.warn(err); toast("Erreur pendant l’ajout"); }
  finally{ btn.disabled = false; btn.textContent = old; }
}

function bindCard(card){
  card.querySelector("#food-search-btn").addEventListener("click", searchByText);
  card.querySelector("#food-barcode-btn").addEventListener("click", searchByBarcode);
  card.querySelector("#food-search-text").addEventListener("keydown", (e) => { if(e.key === "Enter") searchByText(); });
  card.querySelector("#food-barcode-text").addEventListener("keydown", (e) => { if(e.key === "Enter") searchByBarcode(); });
  card.querySelector("#food-search-results").addEventListener("click", (e) => { const b = e.target.closest("[data-food-index]"); if(b) openAdd(Number(b.dataset.foodIndex)); const m = e.target.closest("#manual-product-btn"); if(m) openManual(m.dataset.barcode || ""); });
}

function init(){ ensureCard(); setTimeout(ensureCard, 900); window.addEventListener("focus", () => setTimeout(ensureCard, 400)); }
if(fb) onAuthStateChanged(fb.auth, (u) => { user = u; init(); }); else user = { uid:"demo" };
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
