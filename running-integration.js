import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0,10);
let user = null;
let dataCache = null;
let dataCacheAt = 0;
let dataCacheDate = "";
let syncTimer = null;

const LEVELS = { calm:{label:"Calme",rate:.10}, normal:{label:"Normale",rate:.15}, active:{label:"Active",rate:.20} };
const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v)=>String(v).includes("REMPLACE_MOI"));
const fb = (()=>{ if(!ready()) return null; const app=getApps().length?getApp():initializeApp(firebaseConfig); return {auth:getAuth(app), db:getFirestore(app)}; })();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function local(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function n(v){ return Number(v || 0); }
function fmt(v){ return Math.round(n(v)).toLocaleString("fr-FR"); }
function fmt1(v){ return n(v).toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1}); }
function weekStart(d=new Date()){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function isThisWeek(iso){ const d=new Date(`${iso}T12:00:00`); return d >= weekStart() && d <= new Date(); }
function bmr(profile, weight){ const h=n(profile.height || 1.63)*100; const age=n(profile.age || 35); return Math.round(10*weight + 6.25*h - 5*age + (profile.sex === "male" ? 5 : -161)); }
function levelFor(date){ const k=localStorage.getItem(key(`dailyActivityLevel:${date}`)) || "normal"; return LEVELS[k] || LEVELS.normal; }
function selectedDate(){ return qs("#nutrition-date")?.value || todayISO(); }
function invalidateCache(){ dataCache = null; dataCacheAt = 0; dataCacheDate = ""; }

async function loadAll(date, force = false){
  if(!force && dataCache && dataCacheDate === date && Date.now() - dataCacheAt < 4500) return dataCache;
  if(fb && user){
    const [profileSnap, weightsSnap, walksSnap, strengthSnap, runsSnap, nutritionSnap] = await Promise.all([
      getDoc(doc(fb.db,"users",user.uid,"profile","main")),
      getDocs(query(collection(fb.db,"users",user.uid,"weights"), orderBy("date","desc"))),
      getDocs(query(collection(fb.db,"users",user.uid,"walks"), orderBy("date","desc"))),
      getDocs(query(collection(fb.db,"users",user.uid,"strengthSessions"), orderBy("date","desc"))),
      getDocs(query(collection(fb.db,"users",user.uid,"runs"), orderBy("date","desc"))),
      getDocs(query(collection(fb.db,"users",user.uid,"nutritionEntries"), orderBy("date","desc")))
    ]);
    dataCache = {
      profile:profileSnap.exists()?profileSnap.data():{},
      weights:weightsSnap.docs.map(d=>d.data()),
      walks:walksSnap.docs.map(d=>d.data()),
      strength:strengthSnap.docs.map(d=>d.data()),
      runs:runsSnap.docs.map(d=>d.data()),
      nutrition:nutritionSnap.docs.map(d=>d.data()).filter(e=>e.date===date)
    };
  }else{
    dataCache = { profile:JSON.parse(localStorage.getItem(key("profile")) || "{}"), weights:local("weights"), walks:local("walks"), strength:local("strength"), runs:local("runs"), nutrition:local("nutritionEntries").filter(e=>e.date===date) };
  }
  dataCacheDate = date;
  dataCacheAt = Date.now();
  return dataCache;
}

function sums(data, date){
  const weight=n(data.weights?.[0]?.weight || data.profile?.startWeight || 79.5);
  const basal=bmr(data.profile || {}, weight);
  const level=levelFor(date);
  const dailyLife=Math.round(basal*level.rate);
  const eaten=data.nutrition.reduce((s,e)=>s+n(e.calories),0);
  const walk=data.walks.filter(e=>e.date===date).reduce((s,e)=>s+n(e.calories),0);
  const strength=data.strength.filter(e=>e.date===date).reduce((s,e)=>s+n(e.calories || (e.duration ? e.duration*4 : 0)),0);
  const run=data.runs.filter(e=>e.date===date).reduce((s,e)=>s+n(e.calories || e.manualCalories || e.calculatedCalories),0);
  const activity=dailyLife+walk+strength+run;
  const burned=basal+activity;
  return { eaten, basal, dailyLife, walk, strength, run, activity, burned, deficit:burned-eaten, level };
}

async function syncNutritionDeficit(force = false){
  if(!qs("#nutrition-deficit")) return;
  const date=selectedDate();
  try{
    const data=await loadAll(date, force);
    const s=sums(data,date);
    qs("#nutrition-deficit").textContent=`${s.deficit >= 0 ? "-" : "+"}${fmt(Math.abs(s.deficit))} kcal`;
    qs("#nutrition-burned").textContent=`${fmt(s.burned)} kcal`;
    qs("#nutrition-bmr").textContent=`${fmt(s.basal)} kcal`;
    qs("#nutrition-activity").textContent=`${fmt(s.activity)} kcal`;
    const activityCard=qs("#nutrition-activity")?.closest("article, .nutrition-mini, .nutrition-mini-card");
    const small=activityCard?.querySelector("small");
    if(small) small.textContent = s.run > 0 ? `${s.level.label} + FitFlow + course` : `${s.level.label} + activités FitFlow`;
  }catch(e){ console.warn("Déficit course non synchronisé", e); }
}

function requestSync(delay = 650, force = false){
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNutritionDeficit(force), delay);
}

function ensureWeeklyRunCard(){
  if(qs("#week-run-card")) return qs("#week-run-card");
  const strengthCard=qs("#week-strength")?.closest("article");
  if(!strengthCard?.parentNode) return null;
  const card=document.createElement("article");
  card.id="week-run-card";
  card.className="metric-card";
  card.innerHTML=`<span class="metric-icon">🏃</span><p>Course</p><strong id="week-run-distance">0 km</strong><em id="week-run-calories">0 kcal</em>`;
  strengthCard.insertAdjacentElement("afterend", card);
  return card;
}

async function syncDashboardRunWeek(force = false){
  if(!ensureWeeklyRunCard()) return;
  try{
    const data=await loadAll(todayISO(), force);
    const weekRuns=(data.runs || []).filter(r=>isThisWeek(r.date));
    const distance=weekRuns.reduce((s,r)=>s+n(r.distance),0);
    const calories=weekRuns.reduce((s,r)=>s+n(r.calories || r.manualCalories || r.calculatedCalories),0);
    qs("#week-run-distance").textContent=`${fmt1(distance)} km`;
    qs("#week-run-calories").textContent=`${fmt(calories)} kcal`;
  }catch(e){ console.warn("Carte course semaine non synchronisée", e); }
}

function init(){
  requestSync(400, true);
  syncDashboardRunWeek(true);
  window.addEventListener("focus",()=>requestSync(900));
  window.addEventListener("fitflow:nutrition-data-changed",()=>requestSync(1200, true));
  window.addEventListener("fitflow:nutrition-entry-added",()=>requestSync(1600, true));
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-nav='nutrition'], [data-nav='dashboard'], [data-run-nav], .day-level-selector button")) requestSync(650);
  });
  document.addEventListener("change",e=>{ if(e.target?.id === "nutrition-date"){ invalidateCache(); requestSync(250, true); } });
}

if(fb) onAuthStateChanged(fb.auth,u=>{ user=u; invalidateCache(); init(); }); else { user={uid:"demo"}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init(); }
