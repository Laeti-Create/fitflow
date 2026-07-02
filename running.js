import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
const todayISO = () => new Date().toISOString().slice(0,10);
let user = null;
let runs = [];
let profile = {};

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v)=>String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function saveLocal(name,value){ localStorage.setItem(key(name), JSON.stringify(value)); }
function n(v){ return Number(v || 0); }
function fmt(v,d=1){ return n(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtInt(v){ return Math.round(n(v)).toLocaleString("fr-FR"); }
function fmtDate(iso){ return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function esc(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function toast(msg){
  let t = qs("#nutrition-save-toast");
  if(!t){ t=document.createElement("div"); t.id="nutrition-save-toast"; t.className="nutrition-toast"; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add("active"); clearTimeout(toast.id); toast.id=setTimeout(()=>t.classList.remove("active"),2200);
}

async function loadProfile(){
  try{
    if(fb && user){
      const { getDoc } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");
      const snap = await getDoc(doc(fb.db,"users",user.uid,"profile","main"));
      profile = snap.exists() ? snap.data() : {};
      return;
    }
  }catch(e){ console.warn("Profil running non chargé", e); }
  profile = JSON.parse(localStorage.getItem(key("profile")) || "{}");
}

async function loadRuns(){
  await loadProfile();
  try{
    if(fb && user){
      const snap = await getDocs(query(collection(fb.db,"users",user.uid,"runs"), orderBy("date","desc")));
      runs = snap.docs.map(d=>({id:d.id,...d.data()}));
    }else runs = readLocal("runs");
  }catch(e){ console.warn("Courses non chargées", e); runs = readLocal("runs"); }
  renderRuns();
}

function currentWeight(){
  try{
    const weights = JSON.parse(localStorage.getItem(key("weights")) || "[]");
    const sorted = weights.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return n(sorted[0]?.weight || profile.startWeight || 79.5);
  }catch{ return n(profile.startWeight || 79.5); }
}

function calcRun(distance, duration, manualCalories){
  const pace = distance > 0 ? duration / distance : 0;
  const speed = duration > 0 ? distance / (duration/60) : 0;
  const weight = currentWeight();
  const calculatedCalories = Math.round(distance * weight * 1.02);
  const calories = n(manualCalories) > 0 ? n(manualCalories) : calculatedCalories;
  return { pace:Number(pace.toFixed(2)), speed:Number(speed.toFixed(1)), calculatedCalories, calories };
}

function formatPace(pace){
  const min = Math.floor(n(pace));
  const sec = Math.round((n(pace)-min)*60);
  return `${min}:${String(sec).padStart(2,"0")}/km`;
}

function ensureUI(){
  if(!qs("#view-run")){
    const walkView = qs("#view-walks");
    const section = document.createElement("section");
    section.id = "view-run";
    section.className = "view";
    section.innerHTML = `<header class="tab-header"><button class="back-btn" data-run-nav="dashboard">‹</button><h2>Course à pied 🏃‍♀️</h2></header><article class="run-goal-card"><div><h3>Objectif 10 km</h3><p>Préparation douce pour octobre : régularité, allure et sensations.</p></div><span>🎯</span></article><div class="grid-2 run-stats"><article class="metric-card"><span class="metric-icon">🏃‍♀️</span><p>Distance totale</p><strong id="run-total-distance">0 km</strong></article><article class="metric-card"><span class="metric-icon">🔥</span><p>Calories</p><strong id="run-total-calories">0</strong></article></div><button class="btn btn-primary wide" type="button" data-run-nav="run-form">+ Ajouter une sortie</button><div id="run-list-items" class="history-list"></div>`;
    walkView?.insertAdjacentElement("afterend", section);
  }
  if(!qs("#view-run-form")){
    const addView = qs("#view-walk-form");
    const section = document.createElement("section");
    section.id = "view-run-form";
    section.className = "view";
    section.innerHTML = `<header class="form-header"><button class="back-btn" data-run-nav="add">‹</button><h2>Nouvelle sortie course</h2></header><form id="run-form" class="form-card"><label>Date<input name="date" type="date" required /></label><label>Distance<input name="distance" type="number" min="0" step="0.01" placeholder="Ex : 3,20 km" required /></label><label>Durée<input name="duration" type="number" min="1" step="1" placeholder="Ex : 28 min" required /></label><label>Calories Apple Watch <span>(optionnel)</span><input name="manualCalories" type="number" min="0" step="1" placeholder="Ex : 245 kcal" /></label><label>Type<select name="type"><option value="easy">Footing facile</option><option value="runwalk">Course / marche</option><option value="tempo">Allure soutenue</option><option value="intervals">Fractionné</option><option value="race">Test / course</option></select></label><label>Ressenti<select name="effort"><option value="5">5 / 10</option><option value="6">6 / 10</option><option value="7" selected>7 / 10</option><option value="8">8 / 10</option><option value="9">9 / 10</option><option value="10">10 / 10</option></select></label><label class="textarea-label">Commentaire <span>(optionnel)</span><textarea name="comment" maxlength="120" placeholder="Ex : reprise tranquille, jambes lourdes…"></textarea></label><button class="btn btn-primary wide" type="submit">Enregistrer la sortie</button></form>`;
    addView?.insertAdjacentElement("afterend", section);
  }
  if(!qs("[data-run-nav='run']")){
    const strengthBtn = qs(".bottom-nav [data-nav='strength']");
    const btn = document.createElement("button");
    btn.type = "button"; btn.dataset.runNav = "run"; btn.innerHTML = `🏃<span>Course</span>`;
    strengthBtn?.insertAdjacentElement("beforebegin", btn);
  }
  if(!qs("[data-open-run-form-choice]")){
    const nutritionChoice = qs("[data-open='nutrition-form']")?.closest("button");
    const btn = document.createElement("button");
    btn.className = "choice-card peach"; btn.type="button"; btn.dataset.runNav="run-form"; btn.dataset.openRunFormChoice="1";
    btn.innerHTML = `<span class="choice-icon">🏃‍♀️</span><span><strong>Course à pied</strong><em>Ajoute une sortie running</em></span><b>›</b>`;
    nutritionChoice?.insertAdjacentElement("beforebegin", btn);
  }
  const form = qs("#run-form");
  if(form && !form.dataset.bound){
    form.dataset.bound = "1";
    form.elements.date.value = todayISO();
    form.addEventListener("submit", saveRun);
  }
}

function navigateRun(view){
  qsa(".view").forEach(v=>v.classList.remove("active"));
  qs(`#view-${view}`)?.classList.add("active");
  qsa(".bottom-nav button").forEach(btn=>btn.classList.remove("active"));
  const active = qs(`.bottom-nav [data-run-nav='${view}']`) || qs(`.bottom-nav [data-nav='${view}']`);
  active?.classList.add("active");
  if(view === "run") renderRuns();
}

async function saveRun(e){
  e.preventDefault();
  const form = e.currentTarget;
  const raw = Object.fromEntries(new FormData(form).entries());
  const distance = n(raw.distance);
  const duration = n(raw.duration);
  const computed = calcRun(distance, duration, raw.manualCalories);
  const run = { date:raw.date, distance, duration, manualCalories:n(raw.manualCalories)||null, type:raw.type || "easy", effort:n(raw.effort)||7, comment:raw.comment || "", ...computed };
  try{
    if(fb && user){
      const ref = await addDoc(collection(fb.db,"users",user.uid,"runs"), {...run, createdAt:serverTimestamp()});
      runs = [{...run,id:ref.id}, ...runs];
    }else{ runs = [{...run,id:crypto.randomUUID?.() || String(Date.now())}, ...runs]; saveLocal("runs", runs); }
    form.reset(); form.elements.date.value = todayISO(); toast("Sortie course enregistrée ✅"); navigateRun("run");
  }catch(err){ console.warn(err); toast("Erreur pendant l’enregistrement"); }
}

async function deleteRun(index){
  const run = runs[index];
  if(!run || !confirm("Supprimer cette sortie course ?")) return;
  try{
    if(fb && user && run.id) await deleteDoc(doc(fb.db,"users",user.uid,"runs",run.id));
    runs.splice(index,1); if(!fb || !user) saveLocal("runs", runs); renderRuns();
  }catch(err){ console.warn(err); toast("Suppression impossible"); }
}

function typeLabel(type){ return {easy:"Footing facile",runwalk:"Course / marche",tempo:"Allure soutenue",intervals:"Fractionné",race:"Test / course"}[type] || "Course"; }

function renderRuns(){
  ensureUI();
  const list = qs("#run-list-items");
  if(!list) return;
  const sorted = runs.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const totalDistance = sorted.reduce((s,r)=>s+n(r.distance),0);
  const totalCalories = sorted.reduce((s,r)=>s+n(r.calories),0);
  qs("#run-total-distance") && (qs("#run-total-distance").textContent = `${fmt(totalDistance,1)} km`);
  qs("#run-total-calories") && (qs("#run-total-calories").textContent = fmtInt(totalCalories));
  list.innerHTML = sorted.length ? sorted.map((run,i)=>`<article class="history-card"><div class="avatar">🏃‍♀️</div><div><strong>${fmtDate(run.date)}</strong><small>${fmt(run.distance,2)} km • ${run.duration} min • ${formatPace(run.pace)} • ${fmtInt(run.calories)} kcal</small><div class="card-actions"><button class="mini-action danger delete-run" data-index="${i}">Supprimer</button></div></div><div class="right">${typeLabel(run.type)}<span>Ressenti ${run.effort}/10${run.manualCalories ? " · Watch" : " · calcul"}</span></div></article>`).join("") : `<article class="empty-template">Aucune sortie course pour le moment. Ajoute ta première reprise demain 🏃‍♀️</article>`;
}

function bind(){
  document.addEventListener("click", e=>{
    const nav = e.target.closest("[data-run-nav]");
    if(nav){ e.preventDefault(); navigateRun(nav.dataset.runNav); }
    const del = e.target.closest(".delete-run");
    if(del) deleteRun(Number(del.dataset.index));
  });
}

function init(){ ensureUI(); bind(); loadRuns(); setTimeout(()=>{ensureUI(); renderRuns();},800); }
if(fb) onAuthStateChanged(fb.auth,u=>{ user=u; init(); }); else { user={uid:"demo"}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init(); }
