// Shared by browser, server validation and isolated tests. No network or storage.
export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}
export function requireThat(ok, message) { if (!ok) throw new ValidationError(message); }
export function number(value, min, max, label) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${label} : valeur invalide`);
  return value;
}
export function text(value, max, label) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} : texte requis (maximum ${max})`);
  return value.trim();
}
export function localDate(date = new Date(), timeZone = 'Europe/Paris') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function validDate(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide');
  const parsed = new Date(`${value}T12:00:00Z`);
  requireThat(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value, 'Date inexistante');
  return value;
}
const choice = (value, choices, label) => { requireThat(choices.includes(value), `${label} : choix invalide`); return value; };
const optionalText = (value, max, label) => value === '' || value == null ? '' : text(value, max, label);
const optionalNumber = (value, min, max, label) => value === null || value === undefined ? null : number(value, min, max, label);
export const GOALS = ['strength','glutes','running','recomposition','wellbeing'];
export const DAY_TYPES = ['rest','strength','easy','quality','long','mixed'];

export function validateQuestionnaire(input) {
  requireThat(input && typeof input === 'object', 'Questionnaire requis');
  requireThat(input.adult === true, 'Cette bêta est réservée aux adultes');
  requireThat(Array.isArray(input.goals) && input.goals.length >= 1 && input.goals.length <= 5 && new Set(input.goals).size === input.goals.length && input.goals.every(g => GOALS.includes(g)), 'Objectifs requis, sans doublon');
  requireThat(Array.isArray(input.days) && input.days.length >= 1 && input.days.length <= 7 && new Set(input.days).size === input.days.length && input.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6), 'Jours disponibles invalides');
  const result = {
    adult:true, goals:[...input.goals], days:[...input.days].sort(),
    experience:choice(input.experience, ['beginner','returning','regular'], 'Expérience'),
    minutes:number(input.minutes, 15, 180, 'Durée'),
    strengthDays:number(input.strengthDays,0,7,'Séances musculation'),
    runDays:number(input.runDays,0,7,'Séances course'),
    equipment:text(input.equipment,1000,'Matériel'),
    recentTraining:text(input.recentTraining,2000,'Historique récent'),
    preferences:optionalText(input.preferences,1500,'Préférences'),
    nutrition:optionalText(input.nutrition,1500,'Nutrition'),
    recovery:optionalText(input.recovery,1500,'Récupération'),
    constraints:optionalText(input.constraints,1500,'Contraintes'),
    safety:choice(input.safety, ['none','review','undisclosed'],'Contraintes de santé'),
    aiConsent:input.aiConsent === true,
  };
  requireThat(Number.isInteger(result.strengthDays) && Number.isInteger(result.runDays) && result.strengthDays + result.runDays > 0, 'Nombre entier de séances requis');
  requireThat(result.strengthDays + result.runDays <= result.days.length, 'Réduis les séances ou ajoute des jours (une séance par jour dans cette version)');
  return result;
}
export function coachReadiness(input) {
  const profile = validateQuestionnaire(input);
  const reasons = [];
  if (!profile.aiConsent) reasons.push('Consentement à la transmission au coach absent');
  if (profile.safety !== 'none') reasons.push('Contraintes de santé à clarifier avant une prescription automatisée');
  return { ready:reasons.length === 0, reasons, profile };
}

export function summarizeSets(sets) {
  requireThat(Array.isArray(sets) && sets.length > 0 && sets.length <= 100, 'Entre 1 et 100 séries requises');
  let workSets = 0, knownVolumeKg = 0, unknownVolumeSets = 0;
  const normalized = sets.map(s => {
    const exercise = text(s.exercise,100,'Exercice');
    const reps = number(s.reps,1,100,'Répétitions');
    requireThat(Number.isInteger(reps), 'Répétitions entières requises');
    choice(s.kind,['work','warmup'],'Type de série');
    choice(s.loadType,['external','bodyweight','assisted'],'Charge');
    const loadKg = s.loadType === 'external' ? number(s.loadKg,0,1000,'Charge totale externe') : null;
    const rpe = optionalNumber(s.rpe,1,10,'RPE');
    if(s.kind === 'work') {
      workSets++;
      if(loadKg === null) unknownVolumeSets++; else knownVolumeKg += loadKg * reps;
    }
    return {exercise,reps,kind:s.kind,loadType:s.loadType,loadKg,rpe};
  });
  return {sets:normalized,workSets,knownVolumeKg,unknownVolumeSets};
}
export function progressionProposal(sets, {repMin, repMax, rpeMax}) {
  number(repMin,1,100,'Répétitions minimum'); number(repMax,repMin,100,'Répétitions maximum'); number(rpeMax,1,10,'RPE maximum');
  const work = summarizeSets(sets).sets.filter(s => s.kind === 'work');
  requireThat(new Set(work.map(s => s.exercise)).size <= 1, 'Comparer un seul exercice');
  if(!work.length || work.some(s => s.rpe === null)) return {action:'review',reason:'Effort ou séries de travail manquants'};
  if(work.some(s => s.rpe > rpeMax || s.reps < repMin)) return {action:'maintain',reason:'Consolider la technique et la récupération'};
  if(work.every(s => s.reps >= repMax)) return {action:'consider_load',reason:'Haut de la plage atteint : augmentation à choisir et confirmer'};
  return {action:'consider_reps',reason:'Progresser dans la plage de répétitions avant la charge'};
}

export function previewCalendarImport(input, existing = []) {
  requireThat(input && input.schemaVersion === 1 && Array.isArray(input.sessions) && input.sessions.length <= 366, 'Calendrier version 1, maximum 366 séances');
  const source = text(input.source,80,'Source');
  const seen = new Set();
  const rows = input.sessions.map(s => {
    const sourceId = text(s.id,100,'Identifiant');
    const id = `${encodeURIComponent(source)}:${encodeURIComponent(sourceId)}`;
    requireThat(!seen.has(id),'Identifiant de séance en double'); seen.add(id);
    const row = {id,source,sourceId,date:validDate(s.date),type:choice(s.type,['strength','easy','quality','long'],'Type'),title:text(s.title,120,'Titre'),distanceKm:optionalNumber(s.distanceKm,0.1,200,'Distance'),details:optionalText(s.details,2000,'Détails'),status:'planned'};
    const prior = existing.find(x => x.id === id);
    return {record:row,action:prior ? 'keep' : 'add',reason:prior ? 'Séance déjà importée : état et résultats conservés' : 'Nouvelle séance'};
  });
  return {rows,added:rows.filter(r=>r.action === 'add').length};
}
export function applyCalendarImport(preview, existing) {
  // Re-check IDs at commit time, so a repeated preview is idempotent too.
  const result = structuredClone(existing);
  for(const row of preview.rows) if(row.action === 'add' && !result.some(s=>s.id === row.record.id)) result.push(structuredClone(row.record));
  return result.sort((a,b)=>a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function moveActivity(activity, date) {
  requireThat(activity.status !== 'completed','Une séance terminée conserve sa date historique');
  return {...activity,originalDate:activity.originalDate || activity.date,date:validDate(date)};
}

export function dailyTarget({date,activities,targets,override=null}) {
  validDate(date);
  const kinds = new Set(activities.filter(s=>s.date === date && s.status !== 'skipped').map(s=>s.type));
  for(const kind of kinds) choice(kind,['strength','easy','quality','long'],'Activité');
  const type = kinds.has('strength') && [...kinds].some(k=>k !== 'strength') ? 'mixed' : ['long','quality','easy','strength'].find(k=>kinds.has(k)) || 'rest';
  const selected = override ?? targets[type];
  if(!selected) return {date,type,status:'missing',reason:`Cible ${type} non renseignée`,target:null};
  const kcal = number(selected.kcal,1,10000,'Calories');
  const proteinG = number(selected.proteinG,0,500,'Protéines');
  return {date,type,status:'configured',source:override ? 'override':'schedule',target:{kcal,proteinG}};
}
export function nutritionMean(days) {
  const recorded = days.filter(d=>d.logged === true);
  for(const d of recorded) number(d.kcal,0,20000,'Calories enregistrées');
  return {recordedDays:recorded.length,missingDays:days.length-recorded.length,meanKcal:recorded.length ? recorded.reduce((a,d)=>a+d.kcal,0)/recorded.length : null};
}
export function validateRecovery(input) {
  return {date:validDate(input.date),sleepHours:optionalNumber(input.sleepHours,0,24,'Sommeil'),fatigue:optionalNumber(input.fatigue,0,10,'Fatigue'),soreness:optionalNumber(input.soreness,0,10,'Courbatures'),pain:choice(input.pain,['none','present','unknown'],'Douleur'),notes:optionalText(input.notes,1500,'Notes')};
}
export function recoverySummary(input) {
  const record = validateRecovery(input);
  return {record,needsReview:record.pain === 'present',missing:['sleepHours','fatigue','soreness'].filter(k=>record[k] === null),message:record.pain === 'present' ? 'Douleur signalée : réévaluer la séance ; aucun changement automatique du programme.' : 'Observations enregistrées, sans diagnostic ni score médical.'};
}

// Structural checks only. Scientific applicability requires editorial/human review.
export function validateCoachProposal(proposal, retrievedSources) {
  requireThat(proposal?.schemaVersion === 1,'Proposition version 1 requise');
  text(proposal.summary,8000,'Synthèse');
  requireThat(Array.isArray(proposal.limitations) && proposal.limitations.length > 0,'Limites requises');
  proposal.limitations.forEach(s=>text(s,2000,'Limite'));
  requireThat(Array.isArray(proposal.claims) && proposal.claims.length > 0 && proposal.claims.length <= 100,'Affirmations et références requises');
  const sourceMap = new Map(retrievedSources.map(s=>[s.id,s]));
  for(const claim of proposal.claims) {
    text(claim.text,3000,'Affirmation');
    requireThat(Array.isArray(claim.sourceIds) && claim.sourceIds.length > 0,'Source manquante');
    for(const id of claim.sourceIds) {
      const source = sourceMap.get(id);
      requireThat(source && source.editorialStatus === 'reviewed','Source non récupérée ou non revue');
      const url = new URL(source.url); requireThat(url.protocol === 'https:','Source HTTPS requise');
      validDate(source.checkedOn);
    }
  }
  return {...structuredClone(proposal),status:'proposed'};
}
