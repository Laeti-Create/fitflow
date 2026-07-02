import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let user = null;

const ACTIVITY_LEVELS = {
  calm:{ label:"Calme", rate:0.10 },
  normal:{ label:"Normale", rate:0.15 },
  active:{ label:"Active", rate:0.20 }
};

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function n(v){ return Number(v || 0); }
function fmt(v){ return Math.round(n(v)).toLocaleString("fr-FR"); }
function local(name){ return JSON.parse(localStorage.getItem(key(name)) || "[]"); }
function activityKey(){ return key(`dailyActivityLevel:${todayISO()}`); }
function getLevel(){ return localStorage.getItem(activityKey()) || "normal"; }
function setLevel(level){ localStorage.setItem(activityKey(), ACTIVITY_LEVELS[level] ? level : "normal"); }

function bmr(profile, weight){
  const h = n(profile.height || 1.63) * 100;
  const age = n(profile.age || 35);
  const sex = profile.sex === "male" ? 5 : -161;
  return Math.round(10 * weight + 6.25 * h - 5 * age + sex);
}

async function loadData(){
  const today = todayISO();
  if(fb && user){
    const [profileSnap, weightsSnap, walksSnap, strengthSnap, runsSnap, nutritionSnap] = await Promise.all([
      getDoc(doc(fb.db, "users", user.uid, "profile", "main")),
      getDocs(query(collection(fb.db, "users", user.uid, "weights"), orderBy("date", "desc"))),
      getDocs(query(collection(fb.db, "users", user.uid, "walks"), orderBy("date", "desc"))),
      getDocs(query(collection(fb.db, "users", user.uid, "strengthSessions"), orderBy("date", "desc"))),
      getDocs(query(collection(fb.db, "users", user.uid, "runs"), orderBy("date", "desc"))),
      getDocs(query(collection(fb.db, "users", user.uid, "nutritionEntries"), orderBy("date", "desc")))
    ]);
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    const weights = weightsSnap.docs.map((d) => d.data());
    const walks = walksSnap.docs.map((d) => d.data()).filter((e) => e.date === today);
    const strength = strengthSnap.docs.map((d) => d.data()).filter((e) => e.date === today);
    const runs = runsSnap.docs.map((d) => d.data()).filter((e) => e.date === today);
    const nutrition = nutritionSnap.docs.map((d) => d.data()).filter((e) => e.date === today);
    return { profile, weights, walks, strength, runs, nutrition };
  }
  return { profile:JSON.parse(localStorage.getItem(key("profile")) || "{}"), weights:local("weights"), walks:local("walks").filter((e) => e.date === today), strength:local("strength").filter((e) => e.date === today), runs:local("runs").filter((e) => e.date === today), nutrition:local("nutritionEntries").filter((e) => e.date === today) };
}

function ensureCard(){
  let card = qs("#dashboard-day-summary");
  if(card) return card;
  const motivation = qs(".motivation-card");
  if(!motivation?.parentNode) return null;
  card = document.createElement("article");
  card.id = "dashboard-day-summary";
  card.className = "dashboard-day-card";
  card.innerHTML = `<div class="day-summary-head"><div><h3>Aujourd’hui</h3><small>Estimation du déficit actuel</small></div><span>🔥</span></div><div class="day-level-selector" role="group" aria-label="Niveau d'activité du jour"><button type="button" data-day-level="calm">Calme</button><button type="button" data-day-level="normal">Normale</button><button type="button" data-day-level="active">Active</button></div><div class="day-summary-grid"><div><strong id="dash-day-eaten">0</strong><span>kcal ingérées</span></div><div><strong id="dash-day-burned">0</strong><span>kcal brûlées</span></div><div><strong id="dash-day-deficit">0</strong><span>déficit actuel</span></div></div><p id="dash-day-note" class="day-summary-note">Calcul basé sur métabolisme + activité quotidienne + séances enregistrées.</p>`;
  motivation.insertAdjacentElement("afterend", card);
  card.querySelectorAll("[data-day-level]").forEach((btn) => btn.addEventListener("click", () => { setLevel(btn.dataset.dayLevel); render(); }));
  return card;
}

function updateButtons(level){
  document.querySelectorAll("[data-day-level]").forEach((btn) => btn.classList.toggle("active", btn.dataset.dayLevel === level));
}

async function render(){
  if(!ensureCard()) return;
  try{
    const data = await loadData();
    const levelKey = getLevel();
    const level = ACTIVITY_LEVELS[levelKey] || ACTIVITY_LEVELS.normal;
    updateButtons(levelKey);
    const currentWeight = n(data.weights?.[0]?.weight || data.profile.startWeight || 79.5);
    const basal = bmr(data.profile || {}, currentWeight);
    const dailyLife = Math.round(basal * level.rate);
    const eaten = data.nutrition.reduce((s,e) => s + n(e.calories), 0);
    const walkCalories = data.walks.reduce((s,e) => s + n(e.calories), 0);
    const strengthCalories = data.strength.reduce((s,e) => s + n(e.calories || (e.duration ? e.duration * 4 : 0)), 0);
    const runCalories = (data.runs || []).reduce((s,e) => s + n(e.calories || e.manualCalories || e.calculatedCalories), 0);
    const active = walkCalories + strengthCalories + runCalories;
    const burned = basal + dailyLife + active;
    const deficit = burned - eaten;
    qs("#dash-day-eaten").textContent = fmt(eaten);
    qs("#dash-day-burned").textContent = fmt(burned);
    qs("#dash-day-deficit").textContent = `${deficit >= 0 ? "-" : "+"}${fmt(Math.abs(deficit))}`;
    const detail = active > 0 ? `${level.label} (+${Math.round(level.rate*100)} %) + ${fmt(active)} kcal de séances enregistrées.` : `${level.label} : environ ${fmt(dailyLife)} kcal de mouvements du quotidien.`;
    qs("#dash-day-note").textContent = runCalories > 0 ? `${detail} Dont course : ${fmt(runCalories)} kcal.` : detail;
  }catch(e){ console.warn("Résumé journée non chargé", e); }
}

function init(){ render(); setTimeout(render, 800); window.addEventListener("focus", () => setTimeout(render, 250)); }
if(fb) onAuthStateChanged(fb.auth, (u) => { user = u; render(); }); else user = { uid:"demo" };
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
