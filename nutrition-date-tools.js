const qs = (s) => document.querySelector(s);

function localISO(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso, offset){
  const [y, m, d] = String(iso || localISO()).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + offset);
  return localISO(date);
}

function formatShortDate(iso){
  const [y, m, d] = String(iso || localISO()).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("fr-FR", {
    weekday:"short",
    day:"2-digit",
    month:"2-digit"
  });
}

function relativeLabel(iso){
  const today = localISO();
  if(iso === today) return "Aujourd’hui";
  if(iso === addDays(today, -1)) return "Hier";
  if(iso === addDays(today, 1)) return "Demain";
  return formatShortDate(iso);
}

function ensureStyle(){
  if(qs("#nutrition-date-tools-style")) return;
  const style = document.createElement("style");
  style.id = "nutrition-date-tools-style";
  style.textContent = `
    .nutrition-date-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
    .nutrition-date-tools .mini-action{padding:7px 10px;border-radius:999px;font-size:.82rem}
    .nutrition-date-label{display:block;width:100%;font-size:.8rem;color:#8f6674;margin-top:2px}
    .nutrition-date-tools [data-fitflow-date-active="true"]{box-shadow:0 0 0 2px rgba(239,111,145,.22) inset;font-weight:700}
  `;
  document.head.appendChild(style);
}

function selectedDate(){
  return qs("#nutrition-date")?.value || localISO();
}

function syncNutritionFormDate(){
  const formDate = qs("#nutrition-form input[name='date']");
  if(formDate && !formDate.matches(":focus")) formDate.value = selectedDate();
}

function updateLabels(){
  const iso = selectedDate();
  const heroTitle = qs("#view-nutrition .nutrition-hero h3");
  if(heroTitle) heroTitle.textContent = relativeLabel(iso);

  const label = qs("#nutrition-date-target-label");
  if(label) label.textContent = `Les prochains ajouts Nutrition iront sur : ${relativeLabel(iso)} (${formatShortDate(iso)})`;

  document.querySelectorAll("[data-fitflow-date-offset]").forEach((button) => {
    const target = addDays(localISO(), Number(button.dataset.fitflowDateOffset || 0));
    button.dataset.fitflowDateActive = String(target === iso);
  });
  syncNutritionFormDate();
}

function setNutritionDate(iso){
  const input = qs("#nutrition-date");
  if(!input) return;
  input.value = iso;
  input.dispatchEvent(new Event("change", { bubbles:true }));
  updateLabels();
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-date-changed", { detail:{ date:iso } }));
  setTimeout(() => window.dispatchEvent(new Event("focus")), 100);
}

function ensureDateTools(){
  const hero = qs("#view-nutrition .nutrition-hero");
  const input = qs("#nutrition-date");
  if(!hero || !input) return;
  ensureStyle();

  if(!input.value) input.value = localISO();

  let tools = qs("#nutrition-date-tools");
  if(!tools){
    tools = document.createElement("div");
    tools.id = "nutrition-date-tools";
    tools.className = "nutrition-date-tools";
    tools.innerHTML = `
      <button class="mini-action" type="button" data-fitflow-date-offset="-1">Hier</button>
      <button class="mini-action" type="button" data-fitflow-date-offset="0">Aujourd’hui</button>
      <button class="mini-action" type="button" data-fitflow-date-offset="1">Demain</button>
      <small id="nutrition-date-target-label" class="nutrition-date-label"></small>
    `;
    hero.appendChild(tools);
    tools.addEventListener("click", (event) => {
      const button = event.target.closest("[data-fitflow-date-offset]");
      if(!button) return;
      setNutritionDate(addDays(localISO(), Number(button.dataset.fitflowDateOffset || 0)));
    });
  }

  input.removeEventListener("change", updateLabels);
  input.addEventListener("change", updateLabels);
  updateLabels();
}

function init(){
  ensureDateTools();
  setTimeout(ensureDateTools, 600);
  window.addEventListener("focus", () => setTimeout(ensureDateTools, 120));
  document.addEventListener("click", (event) => {
    if(event.target.closest("[data-nav='nutrition'], [data-open='nutrition-form'], [data-open-nutrition-form]")) {
      setTimeout(ensureDateTools, 180);
      setTimeout(syncNutritionFormDate, 220);
    }
  });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
