import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const PLAN_ID = "10k-sub60-block1-2026";

const SESSIONS = [
  {id:"w1-quality",date:"2026-07-14",label:"Semaine 1 · VMA courte",summary:"2 × 8 × 30 s vite / 30 s marche"},
  {id:"w1-easy",date:"2026-07-16",label:"Semaine 1 · Endurance fondamentale",summary:"30 min en continu"},
  {id:"w1-long",date:"2026-07-19",label:"Semaine 1 · Sortie longue",summary:"40 min en EF stricte"},
  {id:"w2-quality",date:"2026-07-21",label:"Semaine 2 · Seuil",summary:"3 × 5 min à 6’15/km"},
  {id:"w2-easy",date:"2026-07-23",label:"Semaine 2 · Endurance fondamentale",summary:"30 min en continu"},
  {id:"w2-long",date:"2026-07-26",label:"Semaine 2 · Sortie longue progressive",summary:"45 min dont 5 min à 6’00/km"},
  {id:"w3-quality",date:"2026-07-28",label:"Semaine 3 · VMA courte",summary:"2 × 10 × 30 s vite / 30 s marche"},
  {id:"w3-easy",date:"2026-07-30",label:"Semaine 3 · Endurance fondamentale",summary:"35 min en continu"},
  {id:"w3-long",date:"2026-08-02",label:"Semaine 3 · Sortie longue",summary:"50 min en EF stricte"},
  {id:"w4-quality",date:"2026-08-04",label:"Semaine 4 · Seuil",summary:"3 × 6 min à 6’05/km"},
  {id:"w4-easy",date:"2026-08-06",label:"Semaine 4 · Endurance fondamentale",summary:"35 min en continu"},
  {id:"w4-long",date:"2026-08-09",label:"Semaine 4 · Assimilation",summary:"35 min tranquilles"}
];

let user = null;
let runs = [];
let selectedSessionId = null;
let initialized = false;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function storageKey(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function readLocal(name){
  try{ return JSON.parse(localStorage.getItem(storageKey(name)) || (name === "runs" ? "[]" : "{}")); }
  catch{ return name === "runs" ? [] : {}; }
}
function saveLocal(name, value){ localStorage.setItem(storageKey(name), JSON.stringify(value)); }
function dateObj(iso){ return new Date(`${iso}T12:00:00`); }
function fmtDate(iso){ return dateObj(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}); }
function fmt(v,d=1){ return Number(v || 0).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function paceText(pace){
  const value = Number(pace || 0);
  if(!value) return "—";
  const min = Math.floor(value);
  const sec = Math.round((value-min)*60);
  return `${min}:${String(sec).padStart(2,"0")}/km`;
}
function toast(message){
  let element=qs("#nutrition-save-toast");
  if(!element){ element=document.createElement("div"); element.id="nutrition-save-toast"; element.className="nutrition-toast"; document.body.appendChild(element); }
  element.textContent=message; element.classList.add("active"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>element.classList.remove("active"),2200);
}

async function loadRuns(){
  if(fb && user){
    try{
      const snap = await getDocs(collection(fb.db,"users",user.uid,"runs"));
      runs = snap.docs.map((item)=>({id:item.id,...item.data()}));
      return;
    }catch(error){ console.warn("Runs non chargés pour le plan", error); }
  }
  runs = readLocal("runs");
}

function linkedRun(sessionId){
  return runs
    .filter((run)=>run.planId === PLAN_ID && run.planSessionId === sessionId)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || null;
}

function nearestSession(date){
  if(!date) return null;
  const target = dateObj(date).getTime();
  const candidates = SESSIONS
    .map((session)=>({session,distance:Math.abs(dateObj(session.date).getTime()-target)}))
    .filter((item)=>item.distance <= 3*86400000)
    .sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.session || null;
}

function ensurePlanSelect(){
  const form = qs("#run-form");
  if(!form || form.querySelector("[name='planSessionId']")) return;
  const typeLabel = form.querySelector("select[name='type']")?.closest("label");
  const label = document.createElement("label");
  label.className = "run-plan-link-field";
  label.innerHTML = `Séance du programme <span>(optionnel)</span><select name="planSessionId"><option value="">Aucune liaison</option>${SESSIONS.map((session)=>`<option value="${session.id}">${fmtDate(session.date)} · ${session.label}</option>`).join("")}</select><small>FitFlow marquera automatiquement la séance comme réalisée.</small>`;
  typeLabel?.insertAdjacentElement("beforebegin", label);

  const dateInput = form.elements.date;
  const select = form.elements.planSessionId;
  const suggest = () => {
    if(select.value) return;
    const nearest = nearestSession(dateInput.value);
    if(nearest && !linkedRun(nearest.id)) select.value = nearest.id;
  };
  dateInput.addEventListener("change", suggest);
  setTimeout(suggest,100);
}

function updateVisiblePlan(sessionId){
  const card = document.querySelector(`[data-plan-session="${sessionId}"]`);
  if(card){
    card.classList.remove("status-planned","status-postponed");
    card.classList.add("status-completed");
    const status = card.querySelector(".run-plan-status");
    if(status) status.innerHTML = `✅<small>Réalisée</small>`;
  }

  const statuses = readLocal(`runningPlanSessions:${PLAN_ID}`);
  const completed = SESSIONS.filter((session)=>statuses[session.id]?.status === "completed").length;
  const percent = Math.round((completed / SESSIONS.length) * 100);
  const progressStrong = qs(".run-plan-progress-head strong");
  const progressPercent = qs(".run-plan-progress-head span");
  const progressBar = qs(".run-plan-progress span");
  if(progressStrong) progressStrong.textContent = `${completed} / ${SESSIONS.length} séances réalisées`;
  if(progressPercent) progressPercent.textContent = `${percent}%`;
  if(progressBar) progressBar.style.width = `${percent}%`;
}

async function markLinkedSession(run){
  if(!run?.planSessionId) return;
  const session = SESSIONS.find((item)=>item.id === run.planSessionId);
  if(!session) return;
  const payload = {
    planId:PLAN_ID,
    sessionId:session.id,
    date:session.date,
    status:"completed",
    linkedRunId:run.id || null,
    actualDate:run.date,
    actualDistance:Number(run.distance || 0),
    actualDuration:Number(run.duration || 0),
    actualPace:Number(run.pace || 0),
    actualCalories:Number(run.calories || 0),
    actualEffort:Number(run.effort || 0),
    updatedAtLocal:new Date().toISOString()
  };

  const localStatuses = readLocal(`runningPlanSessions:${PLAN_ID}`);
  localStatuses[session.id] = payload;
  saveLocal(`runningPlanSessions:${PLAN_ID}`, localStatuses);

  if(fb && user){
    try{
      await setDoc(doc(fb.db,"users",user.uid,"runningPlanSessions",`${PLAN_ID}-${session.id}`),{...payload,updatedAt:serverTimestamp()},{merge:true});
    }catch(error){ console.warn("Liaison plan/run non sauvegardée", error); }
  }

  const existingIndex = runs.findIndex((item)=>item.id === run.id);
  if(existingIndex >= 0) runs[existingIndex] = run; else runs.unshift(run);
  updateVisiblePlan(session.id);
  toast("Séance du programme validée automatiquement ✅");
  window.dispatchEvent(new CustomEvent("fitflow:running-plan-updated",{detail:{sessionId:session.id,run}}));
}

function comparisonHtml(sessionId){
  const run = linkedRun(sessionId);
  if(!run) return `<section class="run-plan-comparison empty"><h4>Prévu vs réalisé</h4><p>Aucune sortie n’est encore liée à cette séance.</p></section>`;
  return `<section class="run-plan-comparison"><h4>Prévu vs réalisé</h4><div class="run-comparison-grid"><div><span>Distance</span><strong>${fmt(run.distance,2)} km</strong></div><div><span>Durée</span><strong>${Math.round(Number(run.duration||0))} min</strong></div><div><span>Allure</span><strong>${paceText(run.pace)}</strong></div><div><span>Ressenti</span><strong>${Number(run.effort||0)}/10</strong></div></div><small>Sortie du ${dateObj(run.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})} · ${Math.round(Number(run.calories||0))} kcal</small></section>`;
}

function enhanceOpenDetail(){
  const detail = qs("#running-plan-detail");
  if(!detail || !selectedSessionId) return;
  detail.querySelector(".run-plan-comparison")?.remove();
  const actions = detail.querySelector(".run-detail-actions");
  actions?.insertAdjacentHTML("beforebegin",comparisonHtml(selectedSessionId));
}

function bind(){
  if(initialized) return;
  initialized = true;
  document.addEventListener("click",(event)=>{
    const sessionButton=event.target.closest("[data-plan-session]");
    if(sessionButton){
      selectedSessionId=sessionButton.dataset.planSession;
      setTimeout(enhanceOpenDetail,80);
      setTimeout(enhanceOpenDetail,220);
    }
  },true);
  window.addEventListener("fitflow:run-form-opened",()=>setTimeout(ensurePlanSelect,80));
  window.addEventListener("fitflow:run-saved",async(event)=>{
    const run=event.detail?.run;
    if(!run) return;
    await markLinkedSession(run);
    ensurePlanSelect();
    setTimeout(enhanceOpenDetail,100);
  });
  window.addEventListener("fitflow:runs-loaded",(event)=>{
    runs=Array.isArray(event.detail?.runs)?event.detail.runs:runs;
    setTimeout(enhanceOpenDetail,100);
  });
  window.addEventListener("fitflow:running-plan-updated",()=>setTimeout(enhanceOpenDetail,120));
}

async function init(){
  bind();
  await loadRuns();
  ensurePlanSelect();
  setTimeout(ensurePlanSelect,800);
}

if(fb){
  onAuthStateChanged(fb.auth,(currentUser)=>{ user=currentUser; init(); });
}else{
  user={uid:"demo"};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
}
