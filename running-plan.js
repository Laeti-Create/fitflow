import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const todayISO = () => new Date().toISOString().slice(0, 10);
const PLAN_ID = "10k-sub60-block1-2026";

let user = null;
let statuses = {};
let selectedSessionId = null;
let initialized = false;
let renderTimer = null;

const PLAN = {
  id: PLAN_ID,
  name: "10 km Sub-60 — Bloc 1",
  goal: "Courir 10 km en moins de 60 minutes",
  startDate: "2026-07-14",
  endDate: "2026-08-09",
  sessions: [
    {
      id:"w1-quality", week:1, date:"2026-07-14", day:"Mardi", category:"Qualité", type:"VMA courte", icon:"⚡",
      summary:"2 blocs de 8 × 30 s vite / 30 s marche",
      warmup:["Ventoline 15 min avant selon ta prescription habituelle.", "10 min de footing très lent, autour de 8’00/km.", "3 accélérations progressives de 10 s."],
      main:["Bloc 1 : 8 × 30 s vite / 30 s marche.", "2 min de marche entre les deux blocs.", "Bloc 2 : 8 × 30 s vite / 30 s marche."],
      target:["Allure rapide : 5’00 à 5’15/km.", "Effort cible : RPE 9/10."],
      safety:["Reste attentive à ta respiration et à tes tibias."]
    },
    {
      id:"w1-easy", week:1, date:"2026-07-16", day:"Jeudi", category:"Endurance", type:"Endurance fondamentale", icon:"🧘‍♀️",
      summary:"30 min en continu, allure confortable",
      warmup:["Départ très progressif pendant les premières minutes."],
      main:["30 min en continu en endurance fondamentale."],
      target:["Allure indicative : 7’30 à 8’00/km.", "Si le cardio dépasse 160 BPM, marche 1 min."],
      safety:["Priorité au confort et à la protection des tibias."]
    },
    {
      id:"w1-long", week:1, date:"2026-07-19", day:"Dimanche", category:"Sortie longue", type:"EF stricte", icon:"🏃‍♀️",
      summary:"40 min en endurance fondamentale stricte",
      warmup:["Commence très doucement et laisse le souffle se poser."],
      main:["40 min en endurance fondamentale stricte."],
      target:["Aisance respiratoire totale.", "Tu dois pouvoir parler en phrases complètes."],
      safety:["Marche si nécessaire pour garder l’effort facile."]
    },
    {
      id:"w2-quality", week:2, date:"2026-07-21", day:"Mardi", category:"Qualité", type:"Seuil", icon:"⚡",
      summary:"3 × 5 min à 6’15/km, récupération 2 min marche",
      warmup:["Ventoline 15 min avant selon ta prescription habituelle.", "10 min de footing très lent, autour de 8’00/km.", "3 accélérations progressives de 10 s."],
      main:["3 fractions de 5 min à allure seuil.", "2 min de marche entre les fractions."],
      target:["Allure cible : 6’15/km.", "Effort soutenu mais contrôlé."],
      safety:["Ne transforme pas la séance en sprint."]
    },
    {
      id:"w2-easy", week:2, date:"2026-07-23", day:"Jeudi", category:"Endurance", type:"Endurance fondamentale", icon:"🧘‍♀️",
      summary:"30 min en continu, allure confortable",
      warmup:["Départ très progressif pendant les premières minutes."],
      main:["30 min en continu en endurance fondamentale."],
      target:["Allure indicative : 7’30 à 8’00/km.", "Si le cardio dépasse 160 BPM, marche 1 min."],
      safety:["Priorité au confort et à la protection des tibias."]
    },
    {
      id:"w2-long", week:2, date:"2026-07-26", day:"Dimanche", category:"Sortie longue", type:"Progressive", icon:"🏃‍♀️",
      summary:"45 min dont 5 dernières min à 6’00/km",
      warmup:["Commence en endurance fondamentale très facile."],
      main:["40 min en endurance fondamentale.", "5 dernières minutes à l’allure cible de 6’00/km."],
      target:["Aisance respiratoire sur les 40 premières minutes.", "Fin progressive, sans sprint."],
      safety:["Si la fatigue est importante, reste en EF jusqu’au bout."]
    },
    {
      id:"w3-quality", week:3, date:"2026-07-28", day:"Mardi", category:"Qualité", type:"VMA courte", icon:"⚡",
      summary:"2 blocs de 10 × 30 s vite / 30 s marche",
      warmup:["Ventoline 15 min avant selon ta prescription habituelle.", "10 min de footing très lent, autour de 8’00/km.", "3 accélérations progressives de 10 s."],
      main:["Bloc 1 : 10 × 30 s vite / 30 s marche.", "2 min de marche entre les deux blocs.", "Bloc 2 : 10 × 30 s vite / 30 s marche."],
      target:["Allure rapide proche de 5’00 à 5’15/km.", "Effort cible : RPE 9/10."],
      safety:["Garde une foulée propre et arrête si une douleur inhabituelle apparaît."]
    },
    {
      id:"w3-easy", week:3, date:"2026-07-30", day:"Jeudi", category:"Endurance", type:"Endurance fondamentale", icon:"🧘‍♀️",
      summary:"35 min en continu, allure confortable",
      warmup:["Départ très progressif pendant les premières minutes."],
      main:["35 min en continu en endurance fondamentale."],
      target:["Allure indicative : 7’30 à 8’00/km.", "Si le cardio dépasse 160 BPM, marche 1 min."],
      safety:["Objectif confort et protection des tibias."]
    },
    {
      id:"w3-long", week:3, date:"2026-08-02", day:"Dimanche", category:"Sortie longue", type:"EF stricte", icon:"🏃‍♀️",
      summary:"50 min en endurance fondamentale stricte",
      warmup:["Commence très doucement et laisse le souffle se poser."],
      main:["50 min en endurance fondamentale stricte."],
      target:["Aisance respiratoire totale.", "Reste sur une intensité facile du début à la fin."],
      safety:["Marche si nécessaire pour rester dans la bonne zone."]
    },
    {
      id:"w4-quality", week:4, date:"2026-08-04", day:"Mardi", category:"Qualité", type:"Seuil", icon:"⚡",
      summary:"3 × 6 min à 6’05/km, récupération 2 min marche",
      warmup:["Ventoline 15 min avant selon ta prescription habituelle.", "10 min de footing très lent, autour de 8’00/km.", "3 accélérations progressives de 10 s."],
      main:["3 fractions de 6 min à allure seuil.", "2 min de marche entre les fractions."],
      target:["Allure cible : 6’05/km.", "Effort soutenu mais régulier."],
      safety:["Reste contrôlée sur la première fraction."]
    },
    {
      id:"w4-easy", week:4, date:"2026-08-06", day:"Jeudi", category:"Endurance", type:"Endurance fondamentale", icon:"🧘‍♀️",
      summary:"35 min en continu, allure confortable",
      warmup:["Départ très progressif pendant les premières minutes."],
      main:["35 min en continu en endurance fondamentale."],
      target:["Allure indicative : 7’30 à 8’00/km.", "Si le cardio dépasse 160 BPM, marche 1 min."],
      safety:["Objectif confort et protection des tibias."]
    },
    {
      id:"w4-long", week:4, date:"2026-08-09", day:"Dimanche", category:"Assimilation", type:"Sortie tranquille", icon:"🌿",
      summary:"35 min tranquilles",
      warmup:["Départ facile, sans chercher d’allure."],
      main:["35 min tranquilles pour assimiler le bloc."],
      target:["Reste en aisance respiratoire totale."],
      safety:["Tu dois terminer avec la sensation de pouvoir continuer."]
    }
  ]
};

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function storageKey(){ return `fitflow:${user?.uid || "demo"}:runningPlanSessions:${PLAN_ID}`; }
function readLocal(){
  try{ return JSON.parse(localStorage.getItem(storageKey()) || "{}"); }
  catch{ return {}; }
}
function saveLocal(){ localStorage.setItem(storageKey(), JSON.stringify(statuses)); }
function escapeHtml(value){ return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function dateObj(iso){ return new Date(`${iso}T12:00:00`); }
function formatDate(iso){ return dateObj(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"long" }); }
function formatFullDate(iso){ return dateObj(iso).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" }); }
function daysBetween(fromIso, toIso){ return Math.ceil((dateObj(toIso) - dateObj(fromIso)) / 86400000); }
function toast(message){
  let element = qs("#nutrition-save-toast");
  if(!element){ element=document.createElement("div"); element.id="nutrition-save-toast"; element.className="nutrition-toast"; document.body.appendChild(element); }
  element.textContent=message; element.classList.add("active"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>element.classList.remove("active"),2200);
}

function sessionStatus(id){ return statuses[id]?.status || "planned"; }
function statusLabel(status){ return { planned:"Prévue", completed:"Réalisée", postponed:"Reportée" }[status] || "Prévue"; }
function statusIcon(status){ return { planned:"⏳", completed:"✅", postponed:"⏭" }[status] || "⏳"; }

async function loadStatuses(){
  statuses = readLocal();
  if(fb && user){
    try{
      const snap = await getDocs(collection(fb.db, "users", user.uid, "runningPlanSessions"));
      snap.docs.forEach((item) => {
        const data = item.data();
        if(data.planId === PLAN_ID) statuses[data.sessionId || item.id] = data;
      });
    }catch(error){ console.warn("Statuts du plan running non chargés", error); }
  }
  renderPlan();
}

async function saveStatus(sessionId, status){
  const session = PLAN.sessions.find((item) => item.id === sessionId);
  if(!session) return;
  const payload = { planId:PLAN_ID, sessionId, date:session.date, week:session.week, status, updatedAtLocal:new Date().toISOString() };
  statuses[sessionId] = payload;
  saveLocal();
  renderPlan();
  renderDetail(sessionId);

  if(fb && user){
    try{
      await setDoc(doc(fb.db, "users", user.uid, "runningPlanSessions", `${PLAN_ID}-${sessionId}`), { ...payload, updatedAt:serverTimestamp() }, { merge:true });
    }catch(error){
      console.warn("Statut du plan running non sauvegardé", error);
      toast("Statut enregistré localement");
      return;
    }
  }
  toast(status === "completed" ? "Séance marquée comme réalisée ✅" : status === "postponed" ? "Séance marquée comme reportée ⏭" : "Séance remise comme prévue");
}

function nextSession(){
  const today = todayISO();
  return PLAN.sessions.find((session) => session.date >= today && sessionStatus(session.id) !== "completed")
    || PLAN.sessions.find((session) => sessionStatus(session.id) !== "completed")
    || PLAN.sessions[PLAN.sessions.length - 1];
}

function progressData(){
  const completed = PLAN.sessions.filter((session) => sessionStatus(session.id) === "completed").length;
  const postponed = PLAN.sessions.filter((session) => sessionStatus(session.id) === "postponed").length;
  return { completed, postponed, percent:Math.round((completed / PLAN.sessions.length) * 100) };
}

function sessionCard(session){
  const status = sessionStatus(session.id);
  return `<button type="button" class="run-plan-session status-${status}" data-plan-session="${session.id}">
    <span class="run-plan-date"><strong>${escapeHtml(session.day.slice(0,3))}</strong><small>${escapeHtml(formatDate(session.date))}</small></span>
    <span class="run-plan-session-main"><strong>${session.icon} ${escapeHtml(session.type)}</strong><small>${escapeHtml(session.summary)}</small></span>
    <span class="run-plan-status">${statusIcon(status)}<small>${statusLabel(status)}</small></span>
  </button>`;
}

function weekHtml(week){
  const sessions = PLAN.sessions.filter((session) => session.week === week);
  const completed = sessions.filter((session) => sessionStatus(session.id) === "completed").length;
  return `<section class="run-plan-week"><header><strong>Semaine ${week}</strong><span>${completed}/3 réalisée${completed > 1 ? "s" : ""}</span></header>${sessions.map(sessionCard).join("")}</section>`;
}

function ensurePlanUI(){
  const view = qs("#view-run");
  const goalCard = view?.querySelector(".run-goal-card");
  if(!view || !goalCard) return false;

  if(!qs("#running-plan-card")){
    const card = document.createElement("article");
    card.id = "running-plan-card";
    card.className = "running-plan-card";
    goalCard.insertAdjacentElement("afterend", card);
  }

  if(!qs("#running-plan-modal")){
    const modal = document.createElement("div");
    modal.id = "running-plan-modal";
    modal.className = "nutrition-modal-overlay running-plan-overlay";
    modal.innerHTML = `<section class="nutrition-modal running-plan-modal" role="dialog" aria-modal="true"><div id="running-plan-detail"></div></section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => { if(event.target === modal) closeDetail(); });
  }
  return true;
}

function renderPlan(){
  if(!ensurePlanUI()){
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPlan, 300);
    return;
  }
  const card = qs("#running-plan-card");
  const next = nextSession();
  const progress = progressData();
  const days = daysBetween(todayISO(), next.date);
  const timing = next.date === todayISO() ? "Aujourd’hui" : days > 0 ? `Dans ${days} jour${days > 1 ? "s" : ""}` : "À rattraper";

  card.innerHTML = `<div class="run-plan-hero">
    <div><span class="run-plan-kicker">MON PROGRAMME</span><h3>${escapeHtml(PLAN.name)}</h3><p>Du 14 juillet au 9 août 2026 · ${escapeHtml(PLAN.goal)}</p></div><span class="run-plan-target">🎯</span>
  </div>
  <div class="run-plan-progress-head"><strong>${progress.completed} / ${PLAN.sessions.length} séances réalisées</strong><span>${progress.percent}%</span></div>
  <div class="run-plan-progress"><span style="width:${progress.percent}%"></span></div>
  <button type="button" class="run-plan-next" data-plan-session="${next.id}">
    <span><small>PROCHAINE SÉANCE · ${escapeHtml(timing)}</small><strong>${next.icon} ${escapeHtml(next.day)} ${escapeHtml(formatDate(next.date))}</strong><em>${escapeHtml(next.type)} — ${escapeHtml(next.summary)}</em></span><b>›</b>
  </button>
  <details class="run-plan-details"><summary>Voir les 4 semaines <span>⌄</span></summary><div class="run-plan-weeks">${[1,2,3,4].map(weekHtml).join("")}</div></details>`;
}

function listSection(title, items){
  if(!items?.length) return "";
  return `<section class="run-detail-section"><h4>${escapeHtml(title)}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
}

function renderDetail(sessionId){
  const session = PLAN.sessions.find((item) => item.id === sessionId);
  const modal = qs("#running-plan-modal");
  const detail = qs("#running-plan-detail");
  if(!session || !modal || !detail) return;
  selectedSessionId = sessionId;
  const status = sessionStatus(session.id);

  detail.innerHTML = `<div class="nutrition-modal-head"><div><span class="run-plan-kicker">SEMAINE ${session.week} · ${escapeHtml(session.category)}</span><h3>${session.icon} ${escapeHtml(session.type)}</h3><p>${escapeHtml(formatFullDate(session.date))}</p></div><button class="nutrition-modal-close" type="button" data-close-running-plan>×</button></div>
    <div class="run-detail-summary"><strong>${escapeHtml(session.summary)}</strong><span class="status-${status}">${statusIcon(status)} ${statusLabel(status)}</span></div>
    ${listSection("Échauffement", session.warmup)}
    ${listSection("Corps de séance", session.main)}
    ${listSection("Objectifs", session.target)}
    ${listSection("Vigilance", session.safety)}
    <div class="run-detail-actions">
      <button type="button" class="btn btn-primary" data-plan-status="completed">✅ Réalisée</button>
      <button type="button" class="mini-action" data-plan-status="postponed">⏭ Reporter</button>
      <button type="button" class="mini-action" data-plan-status="planned">↩ Remettre prévue</button>
    </div>`;
  modal.classList.add("active");
}

function closeDetail(){
  qs("#running-plan-modal")?.classList.remove("active");
  selectedSessionId = null;
}

function bind(){
  if(initialized) return;
  initialized = true;
  document.addEventListener("click", (event) => {
    const sessionButton = event.target.closest("[data-plan-session]");
    if(sessionButton){ renderDetail(sessionButton.dataset.planSession); return; }
    if(event.target.closest("[data-close-running-plan]")){ closeDetail(); return; }
    const statusButton = event.target.closest("[data-plan-status]");
    if(statusButton && selectedSessionId) saveStatus(selectedSessionId, statusButton.dataset.planStatus);
  });
  window.addEventListener("focus", () => setTimeout(renderPlan, 250));
}

function init(){
  bind();
  renderPlan();
  loadStatuses();
  setTimeout(renderPlan, 900);
}

if(fb){
  onAuthStateChanged(fb.auth, (currentUser) => { user=currentUser; init(); });
}else{
  user={uid:"demo"};
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}
