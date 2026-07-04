import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let user = null;
let targets = { calories:1650, protein:127, fiber:25, waterMl:2000 };
let bound = false;
let renderTimer = null;
let entriesCache = null;
let entriesCacheAt = 0;
let targetsCacheAt = 0;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function dateValue(){ return qs("#nutrition-date")?.value || todayISO(); }
function localKey(name){ return `fitflow:${user?.uid || "demo"}:${name}`; }
function n(v){ return Number(v || 0); }
function fmt(v, d = 0){ return Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits:d, minimumFractionDigits:d }); }
function liters(ml){ return `${fmt(n(ml) / 1000, 2)} L`; }
function invalidateCache(){ entriesCache = null; entriesCacheAt = 0; }

function lastSevenDates(endDate){
  const end = new Date(`${endDate}T12:00:00`);
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

async function loadTargets(force = false){
  if(!force && targetsCacheAt && Date.now() - targetsCacheAt < 60000) return;
  try{
    if(fb && user){
      const snap = await getDoc(doc(fb.db, "users", user.uid, "profile", "main"));
      const p = snap.exists() ? snap.data() : {};
      targets.calories = n(p.calorieTarget) || 1650;
      targets.protein = p.weight ? Math.round(n(p.weight) * (n(p.proteinPerKg) || 1.6)) : 127;
      targets.fiber = n(p.fiberTarget) || 25;
      targets.waterMl = Math.round((n(p.waterTarget) || 2) * 1000);
    }
    targetsCacheAt = Date.now();
  }catch(e){ console.warn("Objectifs tendance non chargés", e); }
}

async function loadNutritionEntries(force = false){
  if(!force && entriesCache && Date.now() - entriesCacheAt < 10000) return entriesCache;
  if(fb && user){
    const snap = await getDocs(query(collection(fb.db, "users", user.uid, "nutritionEntries"), orderBy("date", "desc")));
    entriesCache = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
  }else{
    entriesCache = JSON.parse(localStorage.getItem(localKey("nutritionEntries")) || "[]");
  }
  entriesCacheAt = Date.now();
  return entriesCache;
}

async function loadWaterMap(dates){
  const map = {};
  for(const d of dates) map[d] = 0;

  if(fb && user){
    await Promise.all(dates.map(async (d) => {
      try{
        const snap = await getDoc(doc(fb.db, "users", user.uid, "waterEntries", d));
        map[d] = snap.exists() ? n(snap.data().ml) : 0;
      }catch(e){ map[d] = 0; }
    }));
    return map;
  }

  dates.forEach((d) => { map[d] = n(localStorage.getItem(`fitflow:${user?.uid || "demo"}:water:${d}`)); });
  return map;
}

function ensureCard(){
  let c = qs("#weekly-trends-card");
  if(c) return c;
  const anchor = qs("#water-card") || qs("#estimated-meal-card") || qs("#nutrition-macros")?.closest(".nutrition-card");
  if(!anchor?.parentNode) return null;
  c = document.createElement("article");
  c.id = "weekly-trends-card";
  c.className = "nutrition-card weekly-card";
  c.innerHTML = `<div class="weekly-head"><div><h3>Tendance 7 jours 📊</h3><small id="weekly-period">Moyenne sur 7 jours glissants</small></div></div><div id="weekly-grid" class="weekly-grid"></div><p id="weekly-note" class="weekly-note">Les tendances s’affichent après tes premières saisies.</p>`;
  anchor.parentNode.insertBefore(c, anchor.nextSibling);
  return c;
}

function metric(label, value, sub){
  return `<div class="weekly-metric"><strong>${value}</strong><span>${label}${sub ? ` · ${sub}` : ""}</span></div>`;
}

async function render(force = false){
  if(!ensureCard()) return;
  await loadTargets(force);
  const dates = lastSevenDates(dateValue());
  const entries = await loadNutritionEntries(force);
  const water = await loadWaterMap(dates);
  const byDay = Object.fromEntries(dates.map((d) => [d, { calories:0, protein:0, fiber:0, water:water[d] || 0 }]));

  entries.filter((e) => byDay[e.date]).forEach((e) => {
    byDay[e.date].calories += n(e.calories);
    byDay[e.date].protein += n(e.protein);
    byDay[e.date].fiber += n(e.fiber);
  });

  const days = Object.values(byDay);
  const avg = (field) => days.reduce((s, d) => s + n(d[field]), 0) / 7;
  const proteinOk = days.filter((d) => d.protein >= targets.protein).length;
  const fiberOk = days.filter((d) => d.fiber >= targets.fiber).length;
  const waterOk = days.filter((d) => d.water >= targets.waterMl).length;
  const loggedDays = days.filter((d) => d.calories || d.protein || d.fiber || d.water).length;

  qs("#weekly-period").textContent = `${dates[0].slice(8,10)}/${dates[0].slice(5,7)} → ${dates[6].slice(8,10)}/${dates[6].slice(5,7)}`;
  qs("#weekly-grid").innerHTML = [
    metric("Calories moy.", `${fmt(avg("calories"))} kcal`, `objectif ${fmt(targets.calories)} kcal`),
    metric("Protéines moy.", `${fmt(avg("protein"), 1)} g`, `${proteinOk}/7 jours OK`),
    metric("Fibres moy.", `${fmt(avg("fiber"), 1)} g`, `${fiberOk}/7 jours OK`),
    metric("Eau moy.", liters(avg("water")), `${waterOk}/7 jours OK`)
  ].join("");

  let note = "";
  if(!loggedDays) note = "Aucune donnée sur cette période pour le moment.";
  else if(proteinOk >= 5 && waterOk >= 5) note = "Très bonne régularité sur les protéines et l’hydratation 🩷";
  else if(proteinOk < 4) note = "Priorité douce : remonter la moyenne protéines sur la semaine.";
  else if(waterOk < 4) note = "Priorité douce : boire plus régulièrement sur la semaine.";
  else note = "Tendance globalement régulière. Continue comme ça ✨";
  qs("#weekly-note").textContent = note;
}

function requestRender(delay = 1200, force = false){
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render(force), delay);
}

function bind(){
  if(bound) return; bound = true;
  qs("#nutrition-date")?.addEventListener("change", () => requestRender(350, true));
  window.addEventListener("focus", () => requestRender(900));
  window.addEventListener("fitflow:nutrition-entry-added", () => { invalidateCache(); requestRender(1800, true); });
  window.addEventListener("fitflow:nutrition-data-changed", () => { invalidateCache(); requestRender(1800, true); });
}

function init(){
  try{ ensureCard(); bind(); render(); setTimeout(() => render(), 1200); }catch(e){ console.warn("Tendance 7 jours désactivée", e); }
}

if(fb){ onAuthStateChanged(fb.auth, async (u) => { user = u; invalidateCache(); await render(true); }); } else { user = { uid:"demo" }; }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
