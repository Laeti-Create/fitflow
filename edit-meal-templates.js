import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
let user = null;
let templates = [];
let currentIndex = null;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if (!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(){ return JSON.parse(localStorage.getItem(key("mealTemplates")) || "[]"); }
function saveLocal(value){ localStorage.setItem(key("mealTemplates"), JSON.stringify(value)); }
function num(v){ return Number(v || 0); }
function escapeHtml(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}

async function loadTemplates(){
  try{
    if(fb && user){
      const snap = await getDocs(query(collection(fb.db, "users", user.uid, "mealTemplates"), orderBy("name", "asc")));
      templates = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
    }else templates = readLocal();
  }catch(e){ templates = readLocal(); }
}

function totals(items){
  return items.reduce((t,i) => ({ calories:t.calories+num(i.calories), protein:t.protein+num(i.protein), carbs:t.carbs+num(i.carbs), fat:t.fat+num(i.fat), fiber:t.fiber+num(i.fiber) }), { calories:0, protein:0, carbs:0, fat:0, fiber:0 });
}

function parseDayFoods(){
  return [...document.querySelectorAll(".nutrition-food-item")].map((el) => {
    const small = el.querySelector("small")?.textContent || "";
    const grab = (re) => num((small.match(re)?.[1] || "0").replaceAll(" ","").replace(",","."));
    return { name:el.querySelector("strong")?.textContent?.trim() || "Aliment", calories:grab(/([0-9\s]+) kcal/), protein:grab(/P ([0-9,.]+)/), carbs:grab(/G ([0-9,.]+)/), fat:grab(/L ([0-9,.]+)/), fiber:grab(/F ([0-9,.]+)/) };
  }).filter((i) => i.calories || i.protein || i.carbs || i.fat || i.fiber);
}

function addButtons(){
  document.querySelectorAll(".meal-template-card").forEach((card, index) => {
    const actions = card.querySelector(".meal-template-actions");
    if(!actions || actions.querySelector(".edit-template")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mini-action edit-template";
    b.dataset.index = String(index);
    b.textContent = "Modifier";
    actions.insertBefore(b, actions.firstChild);
  });
}

function modal(){
  let o = qs("#edit-template-modal");
  if(o) return o;
  o = document.createElement("div");
  o.id = "edit-template-modal";
  o.className = "nutrition-modal-overlay";
  o.innerHTML = `<section class="nutrition-modal" role="dialog" aria-modal="true"><div class="nutrition-modal-head"><div><h3>Modifier le repas type</h3><p>Renomme, retire ou ajoute des aliments depuis la journée affichée.</p></div><button class="nutrition-modal-close" type="button">×</button></div><form id="edit-template-form" class="form-card"><label>Nom du repas type <input name="name" type="text" required /></label><div id="edit-template-list" class="template-builder-list"></div><button class="btn btn-primary wide" type="submit">Enregistrer</button></form></section>`;
  document.body.appendChild(o);
  o.querySelector(".nutrition-modal-close").addEventListener("click", () => o.classList.remove("active"));
  o.addEventListener("click", (e) => { if(e.target === o) o.classList.remove("active"); });
  o.querySelector("#edit-template-form").addEventListener("submit", saveEdit);
  return o;
}

function row(item, idx, source, checked){
  return `<label class="template-builder-item"><input type="checkbox" name="item" value="${source}-${idx}" ${checked ? "checked" : ""}/><span><strong>${escapeHtml(item.name)}</strong><small>${Math.round(num(item.calories))} kcal · P ${num(item.protein).toFixed(1)} · G ${num(item.carbs).toFixed(1)} · L ${num(item.fat).toFixed(1)} · F ${num(item.fiber).toFixed(1)}</small></span></label>`;
}

async function openEdit(index){
  await loadTemplates();
  const tpl = templates[index];
  if(!tpl){ toast("Repas type introuvable"); return; }
  currentIndex = index;
  const dayFoods = parseDayFoods();
  const o = modal();
  o.dataset.oldItems = JSON.stringify(tpl.items || []);
  o.dataset.newItems = JSON.stringify(dayFoods);
  qs("#edit-template-form").elements.name.value = tpl.name || "Repas type";
  qs("#edit-template-list").innerHTML = `<p class="meal-template-summary">Aliments du repas type</p>${(tpl.items || []).map((i,idx) => row(i,idx,"old",true)).join("")}${dayFoods.length ? `<p class="meal-template-summary">Ajouter des aliments de la journée affichée</p>${dayFoods.map((i,idx) => row(i,idx,"new",false)).join("")}` : ""}`;
  o.classList.add("active");
}

function selectedItems(){
  const o = qs("#edit-template-modal");
  const oldItems = JSON.parse(o.dataset.oldItems || "[]");
  const newItems = JSON.parse(o.dataset.newItems || "[]");
  return [...document.querySelectorAll("#edit-template-list input[name='item']:checked")].map((box) => {
    const [source, idx] = box.value.split("-");
    return source === "old" ? oldItems[Number(idx)] : newItems[Number(idx)];
  }).filter(Boolean);
}

async function saveEdit(e){
  e.preventDefault();
  const tpl = templates[currentIndex];
  if(!tpl) return;
  const form = e.currentTarget;
  const items = selectedItems();
  if(!items.length){ toast("Garde au moins un aliment"); return; }
  const update = { name:form.elements.name.value.trim() || "Repas type", items, totals:totals(items) };
  const btn = form.querySelector("button[type='submit']");
  const oldText = btn.textContent;
  btn.disabled = true; btn.textContent = "Enregistrement…";
  try{
    if(fb && user && tpl.id) await updateDoc(doc(fb.db, "users", user.uid, "mealTemplates", tpl.id), update);
    else { templates[currentIndex] = { ...tpl, ...update }; templates.sort((a,b) => a.name.localeCompare(b.name)); saveLocal(templates); }
    qs("#edit-template-modal")?.classList.remove("active");
    toast("Repas type modifié ✅");
    window.dispatchEvent(new Event("focus"));
  }catch(err){ console.warn(err); toast("Erreur pendant la modification"); }
  finally{ btn.disabled = false; btn.textContent = oldText; }
}

function bind(){
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".edit-template");
    if(!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openEdit(Number(b.dataset.index));
  }, true);
  setInterval(addButtons, 1500);
  window.addEventListener("focus", () => setTimeout(addButtons, 500));
}

if(fb) onAuthStateChanged(fb.auth, async (u) => { user = u; await loadTemplates(); addButtons(); }); else user = { uid:"demo" };
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { bind(); addButtons(); }); else { bind(); addButtons(); }
