import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let user = null;
let compactTimer = null;
let observerStarted = false;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function saveLocal(name, value){ localStorage.setItem(key(name), JSON.stringify(value)); }
function n(v){ return Number(v || 0); }
function fmt(v, d=1){ return n(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtInt(v){ return Math.round(n(v)).toLocaleString("fr-FR"); }
function esc(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function date(){ return qs("#nutrition-date")?.value || todayISO(); }
function toast(msg){
  let t = qs("#nutrition-save-toast");
  if(!t){ t=document.createElement("div"); t.id="nutrition-save-toast"; t.className="nutrition-toast"; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add("active"); clearTimeout(toast.id); toast.id=setTimeout(()=>t.classList.remove("active"),2200);
}
function refresh(){
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-data-changed", { detail:{ source:"nutrition-pickers", light:true } }));
}
function requestCompact(delay=160){ clearTimeout(compactTimer); compactTimer=setTimeout(compactCards,delay); }

async function loadFavorites(){
  try{
    if(fb && user){
      const snap = await getDocs(query(collection(fb.db,"users",user.uid,"foodFavorites"), orderBy("name","asc")));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    }
  }catch(e){ console.warn("Favoris non chargés", e); }
  return readLocal("foodFavorites");
}
async function loadTemplates(){
  try{
    if(fb && user){
      const snap = await getDocs(query(collection(fb.db,"users",user.uid,"mealTemplates"), orderBy("name","asc")));
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    }
  }catch(e){ console.warn("Repas types non chargés", e); }
  return readLocal("mealTemplates");
}
async function addEntry(entry){
  if(fb && user){
    const docRef = await addDoc(collection(fb.db,"users",user.uid,"nutritionEntries"), {...entry, createdAt:serverTimestamp()});
    entry.id = docRef.id;
    return entry;
  }
  const entries = readLocal("nutritionEntries");
  const localEntry = {...entry, id:crypto.randomUUID?.() || String(Date.now())};
  entries.unshift(localEntry);
  saveLocal("nutritionEntries", entries);
  return localEntry;
}
function calcFavoriteEntry(fav, meal){
  const referenceType = fav.referenceType || "per100";
  const quantity = n(fav.defaultQuantity || (referenceType === "portion" ? 1 : 100));
  const factor = referenceType === "portion" ? quantity : quantity / 100;
  return {
    date:date(), meal, name:fav.name, referenceType, quantity,
    unit:fav.unit || (referenceType === "portion" ? "portion" : "g"),
    servingName:fav.servingName || "portion", servingWeight:fav.servingWeight || null,
    baseCalories:n(fav.baseCalories), baseProtein:n(fav.baseProtein), baseCarbs:n(fav.baseCarbs), baseFat:n(fav.baseFat), baseFiber:n(fav.baseFiber),
    calories:Math.round(n(fav.baseCalories) * factor), protein:Number((n(fav.baseProtein) * factor).toFixed(1)), carbs:Number((n(fav.baseCarbs) * factor).toFixed(1)), fat:Number((n(fav.baseFat) * factor).toFixed(1)), fiber:Number((n(fav.baseFiber) * factor).toFixed(1)),
    favorite:false, source:"favoritePicker"
  };
}
function templateTotals(items){
  return (items||[]).reduce((t,i)=>({calories:t.calories+n(i.calories),protein:t.protein+n(i.protein),carbs:t.carbs+n(i.carbs),fat:t.fat+n(i.fat),fiber:t.fiber+n(i.fiber)}),{calories:0,protein:0,carbs:0,fat:0,fiber:0});
}
function compactCards(){
  const favCard = qs("#nutrition-favorites-card");
  if(favCard && !favCard.dataset.pickerReady){
    favCard.dataset.pickerReady = "1";
    favCard.classList.add("picker-compact-card");
    favCard.innerHTML = `<div class="picker-compact-head"><div><h3>Mes favoris ⭐</h3><small>Ouvre ta liste et sélectionne un ou plusieurs favoris.</small></div><button class="mini-action" id="open-favorites-picker" type="button">Ouvrir</button></div>`;
  }
  const tplCard = qs("#meal-templates-card");
  if(tplCard && !tplCard.dataset.pickerReady){
    const createBtn = tplCard.querySelector("#create-template-from-day")?.outerHTML || `<button class="mini-action" type="button" id="create-template-from-day">+ Créer</button>`;
    tplCard.dataset.pickerReady = "1";
    tplCard.classList.add("picker-compact-card");
    tplCard.innerHTML = `<div class="picker-compact-head"><div><h3>Mes repas types 🍱</h3><small>Ouvre ta liste et sélectionne un ou plusieurs repas types.</small></div><div class="picker-compact-actions">${createBtn}<button class="mini-action" id="open-templates-picker" type="button">Ouvrir</button></div></div>`;
  }
  window.fitflowRequestNutritionLayout?.(120);
}
function startObserver(){
  const root=qs("#view-nutrition");
  if(!root || observerStarted) return;
  observerStarted=true;
  new MutationObserver(()=>requestCompact(220)).observe(root,{childList:true,subtree:false});
}
function ensureOverlay(){
  let o = qs("#nutrition-picker-modal");
  if(o) return o;
  o=document.createElement("div");
  o.id="nutrition-picker-modal";
  o.className="nutrition-modal-overlay";
  o.innerHTML=`<section class="nutrition-modal picker-modal" role="dialog" aria-modal="true"><div class="nutrition-modal-head"><div><h3 id="picker-title">Sélection</h3><p id="picker-subtitle">Sélectionne un ou plusieurs éléments.</p></div><button class="nutrition-modal-close" type="button">×</button></div><form id="nutrition-picker-form" class="form-card"><label>Repas<select name="meal"><option value="breakfast">Petit-déjeuner</option><option value="lunch">Déjeuner</option><option value="dinner">Dîner</option><option value="snack">Collation</option></select></label><div id="picker-list" class="picker-list"></div><button class="btn btn-primary wide" type="submit">Ajouter la sélection</button></form></section>`;
  document.body.appendChild(o);
  o.querySelector(".nutrition-modal-close").addEventListener("click",()=>o.classList.remove("active"));
  o.addEventListener("click",e=>{ if(e.target===o) o.classList.remove("active"); });
  o.querySelector("#nutrition-picker-form").addEventListener("submit", submitPicker);
  return o;
}
async function openFavorites(){
  const o=ensureOverlay();
  const items=await loadFavorites();
  o.dataset.type="favorites";
  o.dataset.items=JSON.stringify(items);
  qs("#picker-title").textContent="Ajouter des favoris ⭐";
  qs("#picker-subtitle").textContent="Coche un ou plusieurs favoris à ajouter au jour.";
  qs("#picker-list").innerHTML = items.length ? items.map((f,i)=>`<label class="picker-item"><input type="checkbox" name="pick" value="${i}"><span><strong>${esc(f.name)}</strong><small>${fmtInt(f.baseCalories)} kcal · P ${fmt(f.baseProtein)} · G ${fmt(f.baseCarbs)} · L ${fmt(f.baseFat)} · quantité par défaut ${fmt(f.defaultQuantity || 100,0)} ${esc(f.unit || "g")}</small></span></label>`).join("") : `<p class="empty-template">Aucun favori enregistré pour le moment.</p>`;
  o.classList.add("active");
}
async function openTemplates(){
  const o=ensureOverlay();
  const items=await loadTemplates();
  o.dataset.type="templates";
  o.dataset.items=JSON.stringify(items);
  qs("#picker-title").textContent="Ajouter des repas types 🍱";
  qs("#picker-subtitle").textContent="Coche un ou plusieurs repas types à ajouter au jour.";
  qs("#picker-list").innerHTML = items.length ? items.map((t,i)=>{ const total=t.totals || templateTotals(t.items); return `<label class="picker-item"><input type="checkbox" name="pick" value="${i}"><span><strong>${esc(t.name)}</strong><small>${fmtInt(total.calories)} kcal · P ${fmt(total.protein)} · G ${fmt(total.carbs)} · L ${fmt(total.fat)} · ${(t.items||[]).length} aliment(s)</small></span></label>`; }).join("") : `<p class="empty-template">Aucun repas type enregistré pour le moment.</p>`;
  o.classList.add("active");
}
async function submitPicker(e){
  e.preventDefault();
  const o=qs("#nutrition-picker-modal");
  const form=e.currentTarget;
  const type=o.dataset.type;
  const items=JSON.parse(o.dataset.items||"[]");
  const selected=[...form.querySelectorAll("input[name='pick']:checked")].map(i=>items[Number(i.value)]).filter(Boolean);
  if(!selected.length){ toast("Sélectionne au moins un élément"); return; }
  const meal=form.elements.meal.value || "breakfast";
  const btn=form.querySelector("button[type='submit']");
  const old=btn.textContent; btn.disabled=true; btn.textContent="Ajout…";
  try{
    const added=[];
    if(type==="favorites"){
      for(const fav of selected){ const entry=calcFavoriteEntry(fav, meal); const saved=await addEntry(entry); added.push(saved || entry); }
    }else{
      for(const tpl of selected){
        for(const item of tpl.items || []){
          const entry={date:date(), meal, name:item.name, referenceType:"templateItem", quantity:1, unit:"portion", servingName:"portion", servingWeight:null, baseCalories:n(item.calories), baseProtein:n(item.protein), baseCarbs:n(item.carbs), baseFat:n(item.fat), baseFiber:n(item.fiber), calories:n(item.calories), protein:n(item.protein), carbs:n(item.carbs), fat:n(item.fat), fiber:n(item.fiber), favorite:false, source:"mealTemplatePicker", templateName:tpl.name};
          const saved=await addEntry(entry); added.push(saved || entry);
        }
      }
    }
    o.classList.remove("active"); toast("Sélection ajoutée ✅");
    added.forEach((entry)=>window.dispatchEvent(new CustomEvent("fitflow:nutrition-entry-added",{detail:{entry}})));
    refresh();
  }catch(err){ console.warn(err); toast("Erreur pendant l’ajout"); }
  finally{ btn.disabled=false; btn.textContent=old; }
}
function init(){
  compactCards();
  setTimeout(()=>{ compactCards(); startObserver(); },800);
  window.addEventListener("focus",()=>requestCompact(180));
  window.addEventListener("fitflow:nutrition-data-changed",()=>requestCompact(180));
  document.addEventListener("click",e=>{
    if(e.target.closest("#open-favorites-picker")) openFavorites();
    if(e.target.closest("#open-templates-picker")) openTemplates();
  });
}

if(fb) onAuthStateChanged(fb.auth,u=>{ user=u; init(); }); else user={uid:"demo"};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
