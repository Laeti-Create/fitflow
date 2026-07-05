const qs = (selector) => document.querySelector(selector);

function parseIntText(selector){
  const text = qs(selector)?.textContent || "0";
  return Number(String(text).replace(/[^0-9-]/g, "")) || 0;
}

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function fmt(value){
  return Math.round(Number(value || 0)).toLocaleString("fr-FR");
}

function adjustNutritionBudget(){
  const nutritionView = qs("#view-nutrition");
  if(!nutritionView) return;

  const consumed = parseIntText("#nutrition-consumed");
  const baseTarget = Number(qs("#nutrition-target")?.dataset.baseTarget || parseIntText("#nutrition-target") || 1650);
  const fitflowActivity = parseIntText("#nutrition-activity");
  const adjustedTarget = baseTarget + Math.max(0, fitflowActivity);
  const left = adjustedTarget - consumed;

  const targetEl = qs("#nutrition-target");
  if(targetEl){
    if(!targetEl.dataset.baseTarget) targetEl.dataset.baseTarget = String(baseTarget);
    targetEl.textContent = fmt(adjustedTarget);
  }

  const leftEl = qs("#nutrition-left");
  if(leftEl){
    leftEl.textContent = `${left >= 0 ? "Restant ajusté" : "Dépassé ajusté"} : ${fmt(Math.abs(left))} kcal`;
  }

  const progress = qs("#nutrition-calorie-progress");
  if(progress){
    progress.style.width = `${clamp((consumed / Math.max(1, adjustedTarget)) * 100, 0, 100)}%`;
  }

  const hero = qs(".nutrition-hero .calorie-big span:last-child");
  if(hero && !hero.dataset.adjustedLabel){
    hero.dataset.adjustedLabel = "true";
    const note = document.createElement("small");
    note.id = "adjusted-calorie-note";
    note.className = "adjusted-calorie-note";
    note.textContent = `Objectif ajusté = ${fmt(baseTarget)} kcal + activités FitFlow`;
    qs(".nutrition-hero")?.appendChild(note);
  }else{
    const note = qs("#adjusted-calorie-note");
    if(note) note.textContent = `Objectif ajusté = ${fmt(baseTarget)} kcal + activités FitFlow`;
  }
}

let scheduled = false;
function requestAdjust(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    adjustNutritionBudget();
  });
}

function init(){
  requestAdjust();
  setTimeout(requestAdjust, 250);
  setTimeout(requestAdjust, 900);
  window.addEventListener("focus", () => setTimeout(requestAdjust, 300));
  window.addEventListener("fitflow:nutrition-entry-added", () => setTimeout(requestAdjust, 180));
  window.addEventListener("fitflow:nutrition-data-changed", () => setTimeout(requestAdjust, 220));
  document.addEventListener("change", (event) => {
    if(event.target?.id === "nutrition-date") setTimeout(requestAdjust, 220);
  });
  const observer = new MutationObserver(requestAdjust);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
