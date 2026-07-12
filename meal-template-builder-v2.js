import { firebaseConfig } from "./firebase-config.js";
import { SIMPLE_FOODS } from "./simple-foods.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs=(s)=>document.querySelector(s);
let user=null;
let overlay=null;
let draft=[];
let searchResults=[];
let favorites=[];
let stream=null;
let scanLoop=0;
let zxingControls=null;
let initialized=false;

const ready=()=>firebaseConfig?.apiKey&&!Object.values(firebaseConfig).some(v=>String(v).includes("REMPLACE_MOI"));
const fb=(()=>{if(!ready())return null;const app=getApps().length?getApp():initializeApp(firebaseConfig);return{auth:getAuth(app),db:getFirestore(app)}})();

function key(name){return `fitflow:${user?.uid||"demo"}:${name}`}
function readLocal(name){try{return JSON.parse(localStorage.getItem(key(name))||"[]")}catch{return[]}}
function n(v){return Number(v||0)}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function normalize(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function fmt(v,d=1){return n(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function toast(message){let t=qs("#nutrition-save-toast");if(!t){t=document.createElement("div");t.id="nutrition-save-toast";t.className="nutrition-toast";document.body.appendChild(t)}t.textContent=message;t.classList.add("active");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("active"),2200)}
function totals(items=draft){return items.reduce((a,i)=>({calories:a.calories+n(i.calories),protein:a.protein+n(i.protein),carbs:a.carbs+n(i.carbs),fat:a.fat+n(i.fat),fiber:a.fiber+n(i.fiber)}),{calories:0,protein:0,carbs:0,fat:0,fiber:0})}
function perQuantity(food,quantity){const factor=n(quantity)/100;return{...food,quantity:n(quantity),unit:food.unit||"g",calories:Math.round(n(food.baseCalories??food.calories)*factor),protein:Number((n(food.baseProtein??food.protein)*factor).toFixed(1)),carbs:Number((n(food.baseCarbs??food.carbs)*factor).toFixed(1)),fat:Number((n(food.baseFat??food.fat)*factor).toFixed(1)),fiber:Number((n(food.baseFiber??food.fiber)*factor).toFixed(1)),baseCalories:n(food.baseCalories??food.calories),baseProtein:n(food.baseProtein??food.protein),baseCarbs:n(food.baseCarbs??food.carbs),baseFat:n(food.baseFat??food.fat),baseFiber:n(food.baseFiber??food.fiber),referenceType:"per100"}}

function ensureOverlay(){
 if(overlay)return overlay;
 overlay=document.createElement("div");overlay.id="meal-template-v2";overlay.className="nutrition-modal-overlay meal-template-v2-overlay";
 overlay.innerHTML=`<section class="nutrition-modal meal-template-v2-modal" role="dialog" aria-modal="true">
 <div class="nutrition-modal-head"><div><h3>Créer un repas type 🍱</h3><p>Construis ton repas directement avec toutes les sources disponibles.</p></div><button class="nutrition-modal-close" type="button" data-v2-close>×</button></div>
 <label class="template-name-label">Nom du repas type<input id="v2-template-name" type="text" placeholder="Ex : Petit-déjeuner protéiné"></label>
 <div class="template-source-tabs">
  <button type="button" data-v2-source="day">Aujourd’hui</button><button type="button" data-v2-source="search">Rechercher</button><button type="button" data-v2-source="favorites">Favoris</button><button type="button" data-v2-source="scan">Scanner 📷</button><button type="button" data-v2-source="manual">Manuel</button>
 </div>
 <div id="v2-source-panel" class="v2-source-panel"></div>
 <div class="v2-draft-head"><strong>Aliments du repas</strong><span id="v2-draft-count">0 aliment</span></div>
 <div id="v2-draft-list" class="v2-draft-list"></div>
 <div id="v2-template-totals" class="meal-template-summary">Ajoute au moins un aliment.</div>
 <button type="button" class="btn btn-primary wide" id="v2-save-template">Enregistrer le repas type</button>
 </section>`;
 document.body.appendChild(overlay);bind();return overlay;
}
function bind(){
 overlay.addEventListener("click",e=>{
  if(e.target===overlay||e.target.closest("[data-v2-close]")){close();return}
  const source=e.target.closest("[data-v2-source]");if(source){openSource(source.dataset.v2Source);return}
  const add=e.target.closest("[data-v2-add]");if(add){addResult(Number(add.dataset.v2Add));return}
  const addDay=e.target.closest("[data-v2-add-day]");if(addDay){addDayItem(Number(addDay.dataset.v2AddDay));return}
  const addFav=e.target.closest("[data-v2-add-fav]");if(addFav){addFavorite(Number(addFav.dataset.v2AddFav));return}
  const del=e.target.closest("[data-v2-delete]");if(del){draft.splice(Number(del.dataset.v2Delete),1);renderDraft();return}
  if(e.target.id==="v2-search-btn")searchFoods();
  if(e.target.id==="v2-barcode-btn")searchBarcode(qs("#v2-barcode-input")?.value);
  if(e.target.id==="v2-manual-add")addManual();
  if(e.target.id==="v2-save-template")saveTemplate();
  if(e.target.id==="v2-stop-scan")stopScan();
 });
 overlay.addEventListener("change",e=>{const input=e.target.closest("[data-v2-qty]");if(input){const i=Number(input.dataset.v2Qty);draft[i]=perQuantity(draft[i],input.value);renderDraft()}});
}
function open(){ensureOverlay();draft=[];qs("#v2-template-name").value="";renderDraft();overlay.classList.add("active");openSource("day")}
function close(){stopScan();overlay?.classList.remove("active")}

function displayedFoods(){return[...document.querySelectorAll("#view-nutrition .nutrition-food-item")].map(item=>{const name=item.querySelector("strong")?.textContent?.trim()||"Aliment";const text=item.querySelector("small")?.textContent||"";const val=r=>Number((text.match(r)?.[1]||"0").replace(" ","").replace(",","."));return{name,quantity:100,unit:"g",calories:val(/([0-9\s]+) kcal/),protein:val(/P ([0-9,.]+)/),carbs:val(/G ([0-9,.]+)/),fat:val(/L ([0-9,.]+)/),fiber:val(/F ([0-9,.]+)/),referenceType:"portion"}}).filter(i=>i.calories||i.protein||i.carbs||i.fat)}
function openSource(source){stopScan();document.querySelectorAll("[data-v2-source]").forEach(b=>b.classList.toggle("active",b.dataset.v2Source===source));if(source==="day")renderDay();if(source==="search")renderSearch();if(source==="favorites")renderFavorites();if(source==="scan")renderScanner();if(source==="manual")renderManual()}
function renderDay(){const foods=displayedFoods();qs("#v2-source-panel").innerHTML=foods.length?`<div class="v2-source-list">${foods.map((f,i)=>resultCard(f,i,"day")).join("")}</div>`:`<p class="empty-template">Aucun aliment dans la journée sélectionnée.</p>`;qs("#v2-source-panel").dataset.day=JSON.stringify(foods)}
function renderSearch(){qs("#v2-source-panel").innerHTML=`<div class="food-search-form"><input id="v2-search-input" type="search" placeholder="Ex : framboise, poulet, skyr…"><button class="mini-action" id="v2-search-btn" type="button">Rechercher</button></div><div id="v2-search-results" class="v2-source-list"></div>`}
async function loadFavorites(){if(fb&&user){try{const snap=await getDocs(query(collection(fb.db,"users",user.uid,"foodFavorites"),orderBy("name","asc")));favorites=snap.docs.map(d=>({id:d.id,...d.data()}));return}catch(e){console.warn(e)}}favorites=readLocal("foodFavorites")}
async function renderFavorites(){qs("#v2-source-panel").innerHTML=`<p class="empty-template">Chargement des favoris…</p>`;await loadFavorites();qs("#v2-source-panel").innerHTML=favorites.length?`<div class="v2-source-list">${favorites.map((f,i)=>resultCard({...f,calories:n(f.baseCalories),protein:n(f.baseProtein),carbs:n(f.baseCarbs),fat:n(f.baseFat),fiber:n(f.baseFiber)},i,"fav")).join("")}</div>`:`<p class="empty-template">Aucun favori enregistré.</p>`}
function renderManual(){qs("#v2-source-panel").innerHTML=`<div class="v2-manual-grid"><label>Nom<input id="v2-manual-name"></label><label>Quantité (g/ml)<input id="v2-manual-qty" type="number" value="100"></label><label>Calories /100<input id="v2-manual-cal" type="number"></label><label>Protéines /100<input id="v2-manual-p" type="number" step="0.1"></label><label>Glucides /100<input id="v2-manual-c" type="number" step="0.1"></label><label>Lipides /100<input id="v2-manual-f" type="number" step="0.1"></label><label>Fibres /100<input id="v2-manual-fi" type="number" step="0.1"></label></div><button type="button" class="mini-action wide" id="v2-manual-add">Ajouter au repas type</button>`}
function renderScanner(){qs("#v2-source-panel").innerHTML=`<div class="v2-scanner"><video id="v2-scan-video" autoplay muted playsinline></video><div class="barcode-frame"><span></span></div></div><p id="v2-scan-status" class="empty-template">Ouverture de la caméra…</p><button type="button" class="mini-action" id="v2-stop-scan">Arrêter</button><div class="food-search-form"><input id="v2-barcode-input" inputmode="numeric" placeholder="Ou saisir le code"><button id="v2-barcode-btn" class="mini-action" type="button">Chercher</button></div>`;startScan()}
function resultCard(f,i,type){const attr=type==="day"?"data-v2-add-day":type==="fav"?"data-v2-add-fav":"data-v2-add";return`<button type="button" class="food-result" ${attr}="${i}"><strong>${esc(f.name)}</strong><span>${Math.round(n(f.calories))} kcal · P ${fmt(f.protein)} · G ${fmt(f.carbs)} · L ${fmt(f.fat)} · F ${fmt(f.fiber)} /100g</span></button>`}

async function searchFoods(){const q=qs("#v2-search-input")?.value.trim();if(!q)return;const box=qs("#v2-search-results");box.innerHTML=`<p class="empty-template">Recherche…</p>`;const local=SIMPLE_FOODS.filter(f=>normalize(f.name).includes(normalize(q))||f.keywords.some(k=>normalize(k).includes(normalize(q))||normalize(q).includes(normalize(k))));let remote=[];try{const url=`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,product_name_fr,brands,nutriments`;const data=await(await fetch(url)).json();remote=(data.products||[]).map(p=>{const nu=p.nutriments||{};return{name:p.product_name_fr||p.product_name||"Produit",barcode:p.code||"",calories:n(nu["energy-kcal_100g"]),protein:n(nu.proteins_100g),carbs:n(nu.carbohydrates_100g),fat:n(nu.fat_100g),fiber:n(nu.fiber_100g)}}).filter(f=>f.calories||f.protein||f.carbs||f.fat)}catch(e){console.warn(e)}searchResults=[...local,...remote];box.innerHTML=searchResults.length?searchResults.map((f,i)=>resultCard(f,i,"search")).join(""):`<p class="empty-template">Aucun résultat exploitable.</p>`}
async function searchBarcode(raw){const code=String(raw||"").replace(/\D/g,"");if(!code)return;stopScan();const panel=qs("#v2-source-panel");panel.innerHTML=`<p class="empty-template">Recherche du code ${esc(code)}…</p>`;try{const data=await(await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_fr,nutriments`)).json();if(data.status!==1)throw new Error("not found");const p=data.product,nu=p.nutriments||{};searchResults=[{name:p.product_name_fr||p.product_name||"Produit",barcode:code,calories:n(nu["energy-kcal_100g"]),protein:n(nu.proteins_100g),carbs:n(nu.carbohydrates_100g),fat:n(nu.fat_100g),fiber:n(nu.fiber_100g)}];panel.innerHTML=searchResults.map((f,i)=>resultCard(f,i,"search")).join("")}catch(e){panel.innerHTML=`<p class="empty-template">Produit non trouvé. Utilise la saisie manuelle.</p>`}}
function addResult(i){const f=searchResults[i];if(f){draft.push(perQuantity(f,100));renderDraft()}}
function addDayItem(i){const items=JSON.parse(qs("#v2-source-panel")?.dataset.day||"[]");if(items[i]){draft.push(items[i]);renderDraft()}}
function addFavorite(i){const f=favorites[i];if(f){draft.push(perQuantity({name:f.name,baseCalories:f.baseCalories,baseProtein:f.baseProtein,baseCarbs:f.baseCarbs,baseFat:f.baseFat,baseFiber:f.baseFiber},n(f.defaultQuantity||100)));renderDraft()}}
function addManual(){const f={name:qs("#v2-manual-name")?.value.trim()||"Aliment manuel",calories:n(qs("#v2-manual-cal")?.value),protein:n(qs("#v2-manual-p")?.value),carbs:n(qs("#v2-manual-c")?.value),fat:n(qs("#v2-manual-f")?.value),fiber:n(qs("#v2-manual-fi")?.value)};draft.push(perQuantity(f,n(qs("#v2-manual-qty")?.value||100)));renderDraft()}
function renderDraft(){const list=qs("#v2-draft-list"),t=totals();qs("#v2-draft-count").textContent=`${draft.length} aliment${draft.length>1?"s":""}`;list.innerHTML=draft.length?draft.map((f,i)=>`<div class="v2-draft-item"><div><strong>${esc(f.name)}</strong><small>${Math.round(n(f.calories))} kcal · P ${fmt(f.protein)} · G ${fmt(f.carbs)} · L ${fmt(f.fat)} · F ${fmt(f.fiber)}</small></div><label><input data-v2-qty="${i}" type="number" value="${n(f.quantity||100)}"><span>${esc(f.unit||"g")}</span></label><button type="button" class="mini-action danger" data-v2-delete="${i}">×</button></div>`).join(""):`<p class="empty-template">Aucun aliment ajouté.</p>`;qs("#v2-template-totals").textContent=draft.length?`${Math.round(t.calories)} kcal · P ${fmt(t.protein)} · G ${fmt(t.carbs)} · L ${fmt(t.fat)} · F ${fmt(t.fiber)}`:"Ajoute au moins un aliment."}
async function saveTemplate(){const name=qs("#v2-template-name")?.value.trim();if(!name){toast("Donne un nom au repas type");return}if(!draft.length){toast("Ajoute au moins un aliment");return}const template={name,items:draft,totals:totals(),createdAtLocal:new Date().toISOString()};try{if(fb&&user)await addDoc(collection(fb.db,"users",user.uid,"mealTemplates"),{...template,createdAt:serverTimestamp()});else{const arr=readLocal("mealTemplates");arr.push({...template,id:crypto.randomUUID?.()||String(Date.now())});localStorage.setItem(key("mealTemplates"),JSON.stringify(arr))}close();toast("Repas type enregistré ✅");window.dispatchEvent(new Event("focus"));window.dispatchEvent(new CustomEvent("fitflow:meal-templates-changed"))}catch(e){console.warn(e);toast("Erreur pendant l’enregistrement")}}

async function startScan(){stopScan();const video=qs("#v2-scan-video"),status=qs("#v2-scan-status");if(!navigator.mediaDevices?.getUserMedia){status.textContent="Caméra indisponible.";return}try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false});video.srcObject=stream;await video.play();status.textContent="Place le code-barres dans le cadre.";if("BarcodeDetector" in window){const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]});const loop=async()=>{if(!stream)return;try{const codes=await detector.detect(video);if(codes?.length){const code=codes[0].rawValue;stopScan();searchBarcode(code);return}}catch(e){}scanLoop=requestAnimationFrame(loop)};scanLoop=requestAnimationFrame(loop)}else{await loadZxing(video,status)}}catch(e){status.textContent="Impossible d’ouvrir la caméra. Saisis le code manuellement."}}
async function loadZxing(video,status){if(!window.ZXingBrowser){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://unpkg.com/@zxing/browser@0.2.0";s.onload=res;s.onerror=rej;document.head.appendChild(s)})}const Reader=window.ZXingBrowser?.BrowserMultiFormatReader;if(!Reader){status.textContent="Scanner indisponible.";return}const reader=new Reader();zxingControls=await reader.decodeFromVideoElement(video,(result)=>{if(result){const code=result.getText?.()||result.text;stopScan();searchBarcode(code)}})}
function stopScan(){if(scanLoop)cancelAnimationFrame(scanLoop);scanLoop=0;if(zxingControls?.stop)zxingControls.stop();zxingControls=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}const v=qs("#v2-scan-video");if(v)v.srcObject=null}

function init(){if(initialized)return;initialized=true;document.addEventListener("click",e=>{const btn=e.target.closest("#create-template-from-day");if(!btn)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open()},true)}
if(fb)onAuthStateChanged(fb.auth,u=>{user=u;init()});else{user={uid:"demo"};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()}
