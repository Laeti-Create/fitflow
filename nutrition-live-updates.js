const qs = (s) => document.querySelector(s);
const fmt = (v, d=1) => Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits:d, maximumFractionDigits:d });
const fmtInt = (v) => Math.round(Number(v || 0)).toLocaleString("fr-FR");
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const todayISO = () => new Date().toISOString().slice(0, 10);

const MEAL_LABELS = {
  breakfast:"Petit-déjeuner",
  lunch:"Déjeuner",
  dinner:"Dîner",
  snack:"Collation"
};
const MACRO_LABELS = {
  protein:"Protéines",
  carbs:"Glucides",
  fat:"Lipides",
  fiber:"Fibres"
};
const applied = new Set();

function selectedDate(){
  return qs("#nutrition-date")?.value || todayISO();
}
function parseNumber(text){
  const match = String(text || "").replace(/\s/g, "").replace(",", ".").match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : 0;
}
function parseSignedKcal(text){
  const raw = String(text || "").trim();
  const value = parseNumber(raw);
  return raw.startsWith("+") ? -Math.abs(value) : Math.abs(value);
}
function entryKey(entry){
  return entry.id || `${entry.date}|${entry.meal}|${entry.name}|${entry.calories}|${entry.quantity}|${entry.source || ""}`;
}
function displayQuantity(entry){
  const q = Number(entry.quantity || 0);
  const unit = entry.unit || "g";
  return `${fmt(q, q % 1 ? 1 : 0)} ${unit}`;
}
function foodHtml(entry, key){
  const idAttrs = entry.id ? ` data-entry-id="${esc(entry.id)}"` : "";
  return `<div class="nutrition-food-item live-added-food" data-live-key="${esc(key)}"${idAttrs}><div><strong>${esc(entry.name)}</strong><small>${displayQuantity(entry)} · ${fmtInt(entry.calories)} kcal · P ${fmt(entry.protein)} · G ${fmt(entry.carbs)} · L ${fmt(entry.fat)} · F ${fmt(entry.fiber)}</small></div><div class="card-actions"><span class="mini-action">Ajouté</span></div></div>`;
}
function findMealCard(meal){
  const label = MEAL_LABELS[meal] || MEAL_LABELS.snack;
  return [...document.querySelectorAll(".nutrition-meal-card")].find((card) => card.querySelector("strong")?.textContent?.trim() === label);
}
function updateProgress(el, value, target){
  const bar = el?.querySelector(".macro-progress > div");
  if(bar && target) bar.style.width = `${Math.max(0, Math.min(100, (value / target) * 100))}%`;
}
function updateMacroRow(field, increment){
  const label = MACRO_LABELS[field];
  const row = [...document.querySelectorAll("#nutrition-macros .macro-row")]
    .find((el) => el.querySelector("strong")?.textContent?.trim() === label);
  if(!row) return;
  const span = row.querySelector(".macro-row-head span");
  if(!span) return;
  const parts = span.textContent.split("/");
  const current = parseNumber(parts[0]);
  const target = parseNumber(parts[1]);
  const next = current + Number(increment || 0);
  const unit = field === "calories" ? "kcal" : "g";
  span.textContent = `${fmt(next, 1)} / ${fmt(target, 0)} ${unit}`;
  updateProgress(row, next, target);
}
function updateMacros(entry){
  updateMacroRow("protein", entry.protein);
  updateMacroRow("carbs", entry.carbs);
  updateMacroRow("fat", entry.fat);
  updateMacroRow("fiber", entry.fiber);
}
function updateTopNumbers(entry){
  const consumed = qs("#nutrition-consumed");
  if(consumed) consumed.textContent = fmtInt(parseNumber(consumed.textContent) + Number(entry.calories || 0));

  const target = qs("#nutrition-target");
  const progress = qs("#nutrition-calorie-progress");
  if(consumed && target && progress){
    const total = parseNumber(consumed.textContent);
    const objective = parseNumber(target.textContent);
    if(objective) progress.style.width = `${Math.max(0, Math.min(100, (total / objective) * 100))}%`;
  }

  const left = qs("#nutrition-left");
  if(left){
    const currentText = left.textContent || "";
    const current = parseNumber(currentText);
    const isOver = currentText.toLowerCase().includes("dépassé");
    const next = isOver ? current + Number(entry.calories || 0) : current - Number(entry.calories || 0);
    left.textContent = `${next >= 0 && !isOver ? "Restant" : "Dépassé"} : ${fmtInt(Math.abs(next))} kcal`;
  }

  const deficit = qs("#nutrition-deficit");
  if(deficit){
    const currentDeficit = parseSignedKcal(deficit.textContent);
    const nextDeficit = currentDeficit - Number(entry.calories || 0);
    deficit.textContent = `${nextDeficit >= 0 ? "-" : "+"}${fmtInt(Math.abs(nextDeficit))} kcal`;
  }
}
function updateMeal(entry, key){
  const card = findMealCard(entry.meal);
  if(!card) return false;
  const list = card.querySelector(".nutrition-food-list");
  if(!list) return false;
  if(list.querySelector(`[data-live-key="${CSS.escape(key)}"]`)) return true;
  if(entry.id && list.querySelector(`[data-entry-id="${CSS.escape(entry.id)}"]`)) return true;
  const empty = list.querySelector(".empty-meal");
  if(empty) empty.remove();
  list.insertAdjacentHTML("afterbegin", foodHtml(entry, key));

  const small = card.querySelector(".meal-head small");
  if(small){
    const kcal = parseNumber(small.textContent) + Number(entry.calories || 0);
    const protein = (small.textContent.match(/P\s*([0-9,.]+)/)?.[1] || "0").replace(",", ".");
    const carbs = (small.textContent.match(/G\s*([0-9,.]+)/)?.[1] || "0").replace(",", ".");
    const fat = (small.textContent.match(/L\s*([0-9,.]+)/)?.[1] || "0").replace(",", ".");
    small.textContent = `${fmtInt(kcal)} kcal · P ${fmt(Number(protein) + Number(entry.protein || 0))} · G ${fmt(Number(carbs) + Number(entry.carbs || 0))} · L ${fmt(Number(fat) + Number(entry.fat || 0))}`;
  }
  return true;
}
function quickRefresh(entry){
  if(!entry) return;
  if(entry.date && entry.date !== selectedDate()) return;
  const key = entryKey(entry);
  if(applied.has(key)) return;
  const inserted = updateMeal(entry, key);
  if(!inserted) return;
  updateTopNumbers(entry);
  updateMacros(entry);
  applied.add(key);
  document.body.classList.add("fitflow-live-updated");
  setTimeout(() => document.body.classList.remove("fitflow-live-updated"), 1200);
}

window.addEventListener("fitflow:nutrition-entry-added", (event) => {
  const entry = event.detail?.entry;
  setTimeout(() => quickRefresh(entry), 60);
  setTimeout(() => quickRefresh(entry), 240);
  setTimeout(() => quickRefresh(entry), 700);
});
