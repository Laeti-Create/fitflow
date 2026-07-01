import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let user = null;
let ml = 0;
let target = 2000;
let bound = false;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((v) => String(v).includes("REMPLACE_MOI"));
const fb = (() => {
  if(!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function date(){ return qs("#nutrition-date")?.value || todayISO(); }
function key(d){ return `fitflow:${user?.uid || "demo"}:water:${d}`; }
function profileKey(){ return `fitflow:${user?.uid || "demo"}:profile`; }
function liters(v){ return `${(Number(v || 0) / 1000).toLocaleString("fr-FR", { minimumFractionDigits:0, maximumFractionDigits:2 })} L`; }

function toast(message){
  let t = qs("#nutrition-save-toast");
  if(!t){ t = document.createElement("div"); t.id = "nutrition-save-toast"; t.className = "nutrition-toast"; document.body.appendChild(t); }
  t.textContent = message;
  t.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("active"), 2200);
}

async function loadTarget(){
  try{
    if(fb && user){
      const snap = await getDoc(doc(fb.db, "users", user.uid, "profile", "main"));
      target = Math.round(Number(snap.exists() ? snap.data().waterTarget : 2) * 1000) || 2000;
    }else{
      const profile = JSON.parse(localStorage.getItem(profileKey()) || "{}");
      target = Math.round(Number(profile.waterTarget || 2) * 1000) || 2000;
    }
  }catch(e){ target = 2000; }
}

async function loadWater(){
  await loadTarget();
  const d = date();
  try{
    if(fb && user){
      const snap = await getDoc(doc(fb.db, "users", user.uid, "waterEntries", d));
      ml = snap.exists() ? Number(snap.data().ml || 0) : 0;
    }else{
      ml = Number(localStorage.getItem(key(d)) || 0);
    }
  }catch(e){ ml = Number(localStorage.getItem(key(d)) || 0); }
  render();
}

async function saveWater(){
  const d = date();
  ml = Math.max(0, Math.round(Number(ml || 0)));
  if(fb && user){
    await setDoc(doc(fb.db, "users", user.uid, "waterEntries", d), { date:d, ml, targetMl:target }, { merge:true });
  }else{
    localStorage.setItem(key(d), String(ml));
  }
  render();
}

function card(){
  let c = qs("#water-card");
  if(c) return c;
  const anchor = qs("#estimated-meal-card") || qs("#nutrition-macros")?.closest(".nutrition-card");
  if(!anchor?.parentNode) return null;
  c = document.createElement("article");
  c.id = "water-card";
  c.className = "nutrition-card water-card";
  c.innerHTML = `<div class="water-top"><div><h3>Eau 💧</h3><small id="water-message">Objectif hydratation du jour</small></div><div class="water-amount"><span id="water-current">0 L</span> / <span id="water-target">2 L</span></div></div><div class="water-progress"><div id="water-progress-fill" class="water-progress-fill"></div></div><div class="water-actions"><button class="mini-action" type="button" data-water-add="250">+250 ml</button><button class="mini-action" type="button" data-water-add="500">+500 ml</button><button class="mini-action" type="button" id="water-edit">Modifier</button></div>`;
  anchor.parentNode.insertBefore(c, anchor.nextSibling);
  return c;
}

function render(){
  if(!card()) return;
  const ratio = target ? Math.min(100, Math.round((ml / target) * 100)) : 0;
  qs("#water-current").textContent = liters(ml);
  qs("#water-target").textContent = liters(target);
  qs("#water-progress-fill").style.width = `${ratio}%`;
  const left = Math.max(0, target - ml);
  qs("#water-message").textContent = ml >= target ? "Objectif atteint, bravo 💧" : ml === 0 ? "Commence avec un premier verre" : `Encore ${liters(left)} pour atteindre l’objectif`;
}

async function addWater(v){ ml += Number(v || 0); await saveWater(); toast(`${liters(ml)} d’eau aujourd’hui 💧`); }
async function editWater(){
  const value = prompt("Quantité d’eau bue aujourd’hui en ml", String(ml));
  if(value === null) return;
  const parsed = Number(String(value).replace(",", "."));
  if(Number.isNaN(parsed) || parsed < 0){ toast("Quantité invalide"); return; }
  ml = parsed;
  await saveWater();
  toast("Eau mise à jour ✅");
}

function bind(){
  if(bound) return; bound = true;
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-water-add]");
    const m = e.target.closest("#water-edit");
    if(a) await addWater(Number(a.dataset.waterAdd));
    if(m) await editWater();
  });
  qs("#nutrition-date")?.addEventListener("change", loadWater);
}

function init(){
  try{ card(); bind(); loadWater(); setTimeout(() => { card(); render(); }, 800); window.addEventListener("focus", () => setTimeout(loadWater, 250)); }catch(e){ console.warn("Eau désactivée", e); }
}

if(fb){ onAuthStateChanged(fb.auth, async (u) => { user = u; await loadWater(); }); } else { user = { uid:"demo" }; }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
