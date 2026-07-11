const qs = (selector) => document.querySelector(selector);

const GUIDED_SESSIONS = {
  "w1-quality": { title:"VMA courte", sessionId:"w1-quality", phases:buildVma(8) },
  "w2-quality": { title:"Seuil 3 × 5 min", sessionId:"w2-quality", phases:buildThreshold(5, "6’15/km") },
  "w3-quality": { title:"VMA courte", sessionId:"w3-quality", phases:buildVma(10) },
  "w4-quality": { title:"Seuil 3 × 6 min", sessionId:"w4-quality", phases:buildThreshold(6, "6’05/km") },
  "w1-easy": { title:"Endurance fondamentale", sessionId:"w1-easy", phases:buildContinuous(30, "EF confortable · surveille le cardio") },
  "w2-easy": { title:"Endurance fondamentale", sessionId:"w2-easy", phases:buildContinuous(30, "EF confortable · surveille le cardio") },
  "w3-easy": { title:"Endurance fondamentale", sessionId:"w3-easy", phases:buildContinuous(35, "EF confortable · surveille le cardio") },
  "w4-easy": { title:"Endurance fondamentale", sessionId:"w4-easy", phases:buildContinuous(35, "EF confortable · surveille le cardio") },
  "w1-long": { title:"Sortie longue EF", sessionId:"w1-long", phases:buildContinuous(40, "Aisance respiratoire totale") },
  "w2-long": { title:"Sortie longue progressive", sessionId:"w2-long", phases:[phase("Endurance fondamentale",40*60,"Allure facile"), phase("Allure cible",5*60,"6’00/km · sans sprint")] },
  "w3-long": { title:"Sortie longue EF", sessionId:"w3-long", phases:buildContinuous(50, "Aisance respiratoire totale") },
  "w4-long": { title:"Assimilation", sessionId:"w4-long", phases:buildContinuous(35, "Très tranquille") }
};

function phase(label, seconds, cue="", kind="run"){ return { label, seconds, cue, kind }; }
function buildContinuous(minutes, cue){ return [phase("Course facile", minutes*60, cue, "easy")]; }
function buildThreshold(minutes, pace){
  const phases=[phase("Échauffement",10*60,"Footing très lent · environ 8’00/km","warmup")];
  for(let i=1;i<=3;i++){
    phases.push(phase(`Seuil ${i}/3`,minutes*60,pace,"fast"));
    if(i<3) phases.push(phase(`Récupération ${i}/2`,2*60,"Marche","recovery"));
  }
  phases.push(phase("Retour au calme",5*60,"Footing ou marche très facile","cooldown"));
  return phases;
}
function buildVma(repetitions){
  const phases=[phase("Échauffement",10*60,"Footing très lent + 3 accélérations progressives","warmup")];
  for(let block=1;block<=2;block++){
    for(let rep=1;rep<=repetitions;rep++){
      phases.push(phase(`Rapide · bloc ${block} · ${rep}/${repetitions}`,30,"5’00 à 5’15/km · RPE 9/10","fast"));
      phases.push(phase(`Marche · bloc ${block} · ${rep}/${repetitions}`,30,"Récupère et contrôle le souffle","recovery"));
    }
    if(block===1) phases.push(phase("Récupération entre blocs",2*60,"Marche","recovery"));
  }
  phases.push(phase("Retour au calme",5*60,"Marche ou footing très facile","cooldown"));
  return phases;
}

let overlay=null;
let current=null;
let phaseIndex=0;
let phaseStartedAt=0;
let pausedAt=0;
let pausedTotal=0;
let isPaused=false;
let tickTimer=0;
let totalStartedAt=0;
let audioContext=null;
let wakeLock=null;

function fmtTime(seconds){
  const value=Math.max(0,Math.ceil(seconds));
  const min=Math.floor(value/60);
  const sec=value%60;
  return `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function totalSeconds(phases){ return phases.reduce((sum,item)=>sum+item.seconds,0); }
function elapsedTotal(){
  if(!totalStartedAt) return 0;
  const end=isPaused ? pausedAt : Date.now();
  return Math.max(0,Math.round((end-totalStartedAt-pausedTotal)/1000));
}
function phaseElapsed(){
  if(!phaseStartedAt) return 0;
  const end=isPaused ? pausedAt : Date.now();
  return Math.max(0,(end-phaseStartedAt-pausedTotal)/1000);
}

function ensureOverlay(){
  if(overlay) return overlay;
  overlay=document.createElement("div");
  overlay.id="running-guided-overlay";
  overlay.className="running-guided-overlay";
  overlay.innerHTML=`<section class="running-guided-screen">
    <header><button type="button" class="guided-close" data-guided-close>×</button><div><small>SÉANCE GUIDÉE</small><h2 id="guided-title">Séance</h2></div><button type="button" class="guided-sound" data-guided-sound>🔔</button></header>
    <div class="guided-phase-card" id="guided-phase-card">
      <span id="guided-phase-count">Phase 1</span>
      <h3 id="guided-phase-label">Échauffement</h3>
      <p id="guided-phase-cue"></p>
      <strong id="guided-timer">00:00</strong>
      <div class="guided-progress"><span id="guided-progress-fill"></span></div>
    </div>
    <div class="guided-meta"><div><span>Temps total</span><strong id="guided-total-time">00:00</strong></div><div><span>Restant</span><strong id="guided-total-left">00:00</strong></div></div>
    <div class="guided-next" id="guided-next"></div>
    <div class="guided-controls">
      <button type="button" class="mini-action" data-guided-prev>↶ Précédente</button>
      <button type="button" class="btn btn-primary" data-guided-pause>Pause</button>
      <button type="button" class="mini-action" data-guided-next>Suivante ↷</button>
    </div>
    <button type="button" class="guided-finish" data-guided-finish>Terminer la séance</button>
  </section>`;
  document.body.appendChild(overlay);
  bindOverlay();
  return overlay;
}

function bindOverlay(){
  overlay.addEventListener("click",async(event)=>{
    if(event.target.closest("[data-guided-close]")){ closeGuided(); return; }
    if(event.target.closest("[data-guided-pause]")){ togglePause(); return; }
    if(event.target.closest("[data-guided-next]")){ advancePhase(); return; }
    if(event.target.closest("[data-guided-prev]")){ previousPhase(); return; }
    if(event.target.closest("[data-guided-finish]")){ finishWorkout(); return; }
    if(event.target.closest("[data-guided-sound]")){ await enableAudio(); signal("test"); }
  });
}

async function enableAudio(){
  try{
    audioContext=audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if(audioContext.state==="suspended") await audioContext.resume();
  }catch(error){ console.warn("Audio indisponible",error); }
}
function signal(type="phase"){
  try{
    if(navigator.vibrate) navigator.vibrate(type==="finish" ? [220,100,220,100,350] : [160,80,160]);
  }catch(e){}
  try{
    if(!audioContext) return;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.frequency.value=type==="finish" ? 880 : 660;
    gain.gain.setValueAtTime(.0001,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.16,audioContext.currentTime+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.22);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime+.24);
  }catch(e){}
}
async function requestWakeLock(){
  try{ if("wakeLock" in navigator) wakeLock=await navigator.wakeLock.request("screen"); }catch(e){}
}
function releaseWakeLock(){ try{ wakeLock?.release?.(); }catch(e){} wakeLock=null; }

function openGuided(sessionId){
  const workout=GUIDED_SESSIONS[sessionId];
  if(!workout) return;
  current=workout;
  phaseIndex=0;
  pausedTotal=0;
  isPaused=false;
  totalStartedAt=Date.now();
  phaseStartedAt=Date.now();
  ensureOverlay().classList.add("active");
  document.body.classList.add("guided-open");
  qs("#guided-title").textContent=workout.title;
  renderPhase();
  startTick();
  requestWakeLock();
}
function closeGuided(){
  if(current && elapsedTotal()>10 && !confirm("Quitter la séance guidée ?")) return;
  stopTick(); releaseWakeLock();
  overlay?.classList.remove("active");
  document.body.classList.remove("guided-open");
  resetState();
}
function resetState(){ current=null; phaseIndex=0; phaseStartedAt=0; totalStartedAt=0; pausedTotal=0; isPaused=false; }
function startTick(){ stopTick(); tickTimer=setInterval(tick,250); tick(); }
function stopTick(){ clearInterval(tickTimer); tickTimer=0; }
function currentPhase(){ return current?.phases?.[phaseIndex] || null; }
function renderPhase(){
  const item=currentPhase(); if(!item) return;
  qs("#guided-phase-count").textContent=`Phase ${phaseIndex+1} / ${current.phases.length}`;
  qs("#guided-phase-label").textContent=item.label;
  qs("#guided-phase-cue").textContent=item.cue || "";
  qs("#guided-phase-card").dataset.kind=item.kind;
  const next=current.phases[phaseIndex+1];
  qs("#guided-next").innerHTML=next ? `<span>Ensuite</span><strong>${next.label}</strong><small>${fmtTime(next.seconds)} · ${next.cue || ""}</small>` : `<span>Dernière phase</span><strong>Tu y es presque 💪</strong>`;
}
function tick(){
  const item=currentPhase(); if(!item || isPaused) return updateDisplay();
  const left=item.seconds-phaseElapsed();
  if(left<=0){ advancePhase(true); return; }
  updateDisplay();
}
function updateDisplay(){
  const item=currentPhase(); if(!item) return;
  const elapsed=phaseElapsed();
  const left=item.seconds-elapsed;
  qs("#guided-timer").textContent=fmtTime(left);
  qs("#guided-progress-fill").style.width=`${Math.min(100,Math.max(0,(elapsed/item.seconds)*100))}%`;
  qs("#guided-total-time").textContent=fmtTime(elapsedTotal());
  qs("#guided-total-left").textContent=fmtTime(Math.max(0,totalSeconds(current.phases)-elapsedTotal()));
  qs("[data-guided-pause]").textContent=isPaused ? "Reprendre" : "Pause";
}
function advancePhase(auto=false){
  if(!current) return;
  if(phaseIndex>=current.phases.length-1){ finishWorkout(); return; }
  phaseIndex+=1;
  phaseStartedAt=Date.now(); pausedTotal=0; pausedAt=0; isPaused=false;
  renderPhase(); updateDisplay(); signal(auto?"phase":"phase");
}
function previousPhase(){
  if(!current || phaseIndex===0) return;
  phaseIndex-=1; phaseStartedAt=Date.now(); pausedTotal=0; pausedAt=0; isPaused=false;
  renderPhase(); updateDisplay(); signal("phase");
}
function togglePause(){
  if(!current) return;
  if(isPaused){
    pausedTotal+=Date.now()-pausedAt;
    isPaused=false;
    requestWakeLock();
  }else{
    pausedAt=Date.now(); isPaused=true; releaseWakeLock();
  }
  updateDisplay();
}
function finishWorkout(){
  if(!current) return;
  const duration=Math.max(1,Math.round(elapsedTotal()/60));
  const sessionId=current.sessionId;
  stopTick(); releaseWakeLock(); signal("finish");
  overlay.classList.remove("active"); document.body.classList.remove("guided-open");
  window.fitflowGuidedRunDraft={ sessionId, duration, date:new Date().toISOString().slice(0,10) };
  window.dispatchEvent(new CustomEvent("fitflow:guided-workout-finished",{detail:window.fitflowGuidedRunDraft}));
  resetState();
  setTimeout(()=>{
    const nav=document.querySelector("[data-run-nav='run-form']");
    nav?.click();
    setTimeout(()=>{
      const form=qs("#run-form");
      if(!form) return;
      if(form.elements.date) form.elements.date.value=window.fitflowGuidedRunDraft.date;
      if(form.elements.duration) form.elements.duration.value=window.fitflowGuidedRunDraft.duration;
      if(form.elements.planSessionId) form.elements.planSessionId.value=window.fitflowGuidedRunDraft.sessionId;
      if(form.elements.comment && !form.elements.comment.value) form.elements.comment.value="Séance guidée FitFlow";
    },220);
  },180);
}

function injectGuidedButton(){
  const detail=qs("#running-plan-detail");
  if(!detail || detail.querySelector("[data-start-guided]")) return;
  const sessionButton=document.querySelector("#running-plan-modal [data-plan-session]");
  const heading=detail.querySelector(".run-plan-kicker")?.textContent || "";
  let sessionId=null;
  const visibleTitle=detail.querySelector("h3")?.textContent || "";
  Object.entries(GUIDED_SESSIONS).some(([id,workout])=>{
    const match=visibleTitle.includes(workout.title.split(" ")[0]) && !detail.dataset.guidedMatched;
    if(match){ sessionId=id; return true; }
    return false;
  });
  const openSession=document.querySelector("#running-plan-modal.active")?.dataset?.sessionId;
  sessionId=openSession || window.fitflowSelectedRunningPlanSession || sessionId;
  if(!sessionId || !GUIDED_SESSIONS[sessionId]) return;
  const summary=detail.querySelector(".run-detail-summary");
  const button=document.createElement("button");
  button.type="button"; button.className="btn btn-primary wide start-guided-btn"; button.dataset.startGuided=sessionId;
  button.textContent="▶ Démarrer la séance guidée";
  summary?.insertAdjacentElement("afterend",button);
}

function init(){
  document.addEventListener("click",(event)=>{
    const session=event.target.closest("[data-plan-session]");
    if(session){
      window.fitflowSelectedRunningPlanSession=session.dataset.planSession;
      const modal=qs("#running-plan-modal"); if(modal) modal.dataset.sessionId=session.dataset.planSession;
      setTimeout(injectGuidedButton,80); setTimeout(injectGuidedButton,220);
    }
    const start=event.target.closest("[data-start-guided]");
    if(start){ enableAudio(); openGuided(start.dataset.startGuided); }
  },true);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden && current && !isPaused) requestWakeLock(); });
  window.addEventListener("fitflow:running-plan-updated",()=>setTimeout(injectGuidedButton,100));
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
