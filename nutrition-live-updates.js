const qs = (s) => document.querySelector(s);
const fmt = (v, d=1) => Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits:d, maximumFractionDigits:d });
const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString("fr-FR");
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

const MEAL_LABELS = {
  breakfast:"Petit-déjeuner",
  lunch:"Déjeuner",
  dinner:"Dîner",
  snack:"Collation"
};

function parseNumber(text){
  const match = String(text || "").replace(/\s/g, "").replace(",", ".").match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : 0;
}

function displayQuantity(entry){
  const q = Number(entry.quantity || 0);
  const unit = entry.unit || "g";
  return `${fmt(q, q % 1 ? 1 : 0)} ${unit}`;
}

function foodHtml(entry){
  return `<div class="nutrition-food-item live-added-food"><div><strong>${esc(entry.name)}</strong><small>${displayQuantity(entry)} · ${fmtInt(entry.calories)} kcal · P ${fmt(entry.protein)} · G ${fmt(entry.carbs)} · L ${fmt(entry.fat)} · F ${fmt(entry.fiber)}</small></div><div class="card-actions"><span class="mini-action">Ajouté</span></div></div>`;
}

function findMealCard(meal){
  const label = MEAL_LABELS[meal] || MEAL_LABELS.snack;
  return [...document.querySelectorAll(".nutrition-meal-card")].find((card) => card.querySelector("strong")?.textContent?.trim() === label);
}

function updateTopNumbers(entry){
  const consumed = qs("#nutrition-consumed");
  if(consumed) consumed.textContent = fmtInt(parseNumber(consumed.textContent) + Number(entry.calories || 0));

  const left = qs("#nutrition-left");
  if(left){
    const currentText = left.textContent || "";
    const current = parseNumber(currentText);
    const isOver = currentText.toLowerCase().includes("dépassé");
    const next = isOver ? current + Number(entry.calories || 0) : current - Number(entry.calories || 0);
    left.textContent = `${next >= 0 && !isOver ? "Restant" : "Dépassé"} : ${fmtInt(Math.abs(next))} kcal`;
  }
}

function updateMeal(entry){
  const card = findMealCard(entry.meal);
  if(!card) return false;
  const list = card.querySelector(".nutrition-food-list");
  if(!list) return false;
  const empty = list.querySelector(".empty-meal");
  if(empty) empty.remove();
  list.insertAdjacentHTML("afterbegin", foodHtml(entry));

  const small = card.querySelector(".meal-head small");
  if(small){
    const kcal = parseNumber(small.textContent) + Number(entry.calories || 0);
    small.textContent = `${fmtInt(kcal)} kcal · P +${fmt(entry.protein)} · G +${fmt(entry.carbs)} · L +${fmt(entry.fat)}`;
  }
  return true;
}

function quickRefresh(entry){
  if(!entry) return;
  updateTopNumbers(entry);
  updateMeal(entry);
  document.body.classList.add("fitflow-live-updated");
  setTimeout(() => document.body.classList.remove("fitflow-live-updated"), 1200);
}

window.addEventListener("fitflow:nutrition-entry-added", (event) => {
  const entry = event.detail?.entry;
  quickRefresh(entry);
  setTimeout(() => quickRefresh(entry), 350);
  setTimeout(() => quickRefresh(entry), 900);
});
