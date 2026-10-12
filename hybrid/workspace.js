import {isLocalDevelopment,firebaseApp} from '../firebase-config.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import * as domain from './domain.mjs';
import {createSessionStore} from './session.mjs';
import {localRepository} from './firebase-repository.js';

// Deliberately gated by hostname, not a client query flag claiming production access.
if(isLocalDevelopment) init();
function init() {
  const style=document.createElement('link');style.rel='stylesheet';style.href='./hybrid/workspace.css';document.head.append(style);
  const auth=getAuth(firebaseApp), store=createSessionStore(), repo=localRepository(store);
  let card, preview=null, calendar=[], sets=[], strengthId=crypto.randomUUID();
  let revisions=new Map();
  const labels={strength:'Force',glutes:'Fessiers',running:'Course',recomposition:'Recomposition',wellbeing:'Bien-être'};
  const dayLabels=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const targetLabels={rest:'Repos',strength:'Musculation',easy:'Course facile',quality:'Course qualité',long:'Sortie longue',mixed:'Musculation + course'};
  const input=(name,label,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
  const area=(name,label,max)=>`<label>${label}<textarea name="${name}" maxlength="${max}"></textarea></label>`;
  const login=document.createElement('div');
  login.innerHTML='<p class="muted small">Développement local — comptes fictifs des émulateurs</p><button class="btn" type="button">Se connecter avec Alice (test)</button><p role="status"></p>';
  document.querySelector('.login-card')?.append(login);
  login.querySelector('button').onclick=async()=>{
    const b=login.querySelector('button');b.disabled=true;
    try {await signInWithEmailAndPassword(auth,'alice@example.test','fitflow-local-test-only');}
    catch {login.querySelector('[role=status]').textContent='Lance les émulateurs puis npm run seed:local. Aucun compte réel n’est utilisé.';}
    finally {b.disabled=false;}
  };
  function output(id,message) { const node=card?.querySelector(`#${id}`);if(node) node.textContent=message; }
  function values(form) {return Object.fromEntries(new FormData(form));}
  const n=v=>v === '' || v == null ? null : Number(v);
  function mount() {
    card?.remove();card=document.createElement('article');card.className='settings-card hybrid-card';card.id='hybrid-workspace';
    card.innerHTML=`<h3>Mon programme hybride</h3>
      <p class="hybrid-status">Préparation locale · données fictives uniquement. Sauvegardes dans les émulateurs. Le coach IA n’est pas connecté.</p>
      <details open><summary>1. Mon questionnaire</summary>
      <form id="hybrid-profile">
      <label class="hybrid-check"><input name="adult" type="checkbox" required>J’ai au moins 18 ans</label>
      <fieldset><legend>Objectifs (choisir ensuite la priorité principale)</legend>${Object.entries(labels).map(([v,l])=>`<label class="hybrid-check"><input type="checkbox" name="goals" value="${v}">${l}</label>`).join('')}</fieldset>
      <label>Priorité principale<select name="priority">${Object.entries(labels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>Expérience<select name="experience"><option value="beginner">Débutante</option><option value="returning">Reprise</option><option value="regular">Pratique régulière</option></select></label>
      <fieldset><legend>Jours disponibles</legend>${dayLabels.map((l,i)=>`<label class="hybrid-check"><input type="checkbox" name="days" value="${i}">${l}</label>`).join('')}</fieldset>
      <div class="hybrid-row">${input('strengthDays','Séances musculation / semaine','number','min="0" max="7" step="1" required')}${input('runDays','Séances course / semaine','number','min="0" max="7" step="1" required')}</div>
      ${input('minutes','Minutes disponibles par séance','number','min="15" max="180" required')}
      ${area('equipment','Matériel disponible (requis)',1000)}${area('recentTraining','Dernières semaines : séances, charges/allures connues, interruption éventuelle (requis)',2000)}
      ${area('preferences','Préférences et exercices appréciés ou évités — facultatif',1500)}
      ${area('nutrition','Organisation alimentaire, préférences et allergies à prendre en compte — facultatif',1500)}
      ${area('recovery','Sommeil, fatigue, contraintes de travail — facultatif',1500)}
      <label>Contraintes de santé pour le programme<select name="safety"><option value="undisclosed">Je préfère en discuter / ne pas répondre</option><option value="none">Aucune contrainte connue à signaler</option><option value="review">Une contrainte nécessite un avis ou une adaptation</option></select></label>
      ${area('constraints','Adaptations déjà recommandées par un professionnel — facultatif, sans document médical',1500)}
      <label class="hybrid-check"><input type="checkbox" name="aiConsent">J’autorise l’envoi de ces réponses à OpenAI pour préparer une proposition, lorsque le coach sera connecté.</label>
      <p class="muted small">Aucun envoi à OpenAI dans cette version. L’absence de consentement n’empêche pas la sauvegarde. Un formulaire ne remplace pas une évaluation médicale.</p>
      <button class="btn btn-primary" type="submit">Vérifier et enregistrer le questionnaire</button>
      <button class="btn" type="button" id="hybrid-load-profile">Recharger ma dernière version</button>
      </form><output id="hybrid-profile-result" aria-live="polite"></output></details>
      <details><summary>2. Musculation · séries réalisées</summary>
      <form id="hybrid-set">${input('exercise','Exercice (nom anglais)','text','required maxlength="100"')}
      <div class="hybrid-row">${input('reps','Répétitions réalisées','number','min="1" max="100" required')}${input('loadKg','Charge externe totale en kg','number','min="0" max="1000" step="0.5"')}</div>
      <label>Charge<select name="loadType"><option value="external">Charge externe</option><option value="bodyweight">Poids du corps</option><option value="assisted">Assistance (volume non calculé)</option></select></label>
      <label>Type<select name="kind"><option value="work">Série de travail</option><option value="warmup">Échauffement</option></select></label>
      ${input('rpe','RPE ressenti (facultatif)','number','min="1" max="10" step="0.5"')}
      <p class="muted small">Charge totale des haltères/barre ; pour un exercice unilatéral, saisir chaque côté comme une série distincte. Ne pas déduire le poids du corps.</p>
      <button class="btn" type="submit">Ajouter la série au brouillon</button></form>
      <ul id="hybrid-sets"></ul><button class="btn" id="hybrid-undo-set" type="button">Retirer la dernière série</button>
      <form id="hybrid-strength-save">${input('name','Nom de la séance','text','required maxlength="120"')}${input('date','Date','date','required')}
      <button class="btn btn-primary" type="submit">Enregistrer la séance réalisée</button></form><output id="hybrid-strength-result" aria-live="polite"></output></details>
      <details><summary>3. Running · calendrier</summary><p>Importer un calendrier JSON version 1. L’aperçu est obligatoire. Les séances déjà présentes seront conservées.</p>
      <form id="hybrid-import"><label>Fichier JSON<input name="file" type="file" accept=".json,application/json" required></label><button class="btn" type="submit">Prévisualiser le calendrier</button></form>
      <output id="hybrid-calendar-preview"></output><button id="hybrid-import-confirm" class="btn btn-primary" type="button" disabled>Confirmer l’import</button>
      <button id="hybrid-calendar-load" class="btn" type="button">Charger mon calendrier</button><output id="hybrid-calendar-result" aria-live="polite"></output></details>
      <details><summary>4. Nutrition · cible du jour</summary><p>Renseigne tes cibles choisies ou validées avec un professionnel. Ce formulaire ne prescrit pas de déficit. Le calendrier détermine le type de journée ; les calories d’exercice ne sont pas ajoutées.</p>
      <form id="hybrid-target">${input('date','Date','date','required')}
      ${Object.entries(targetLabels).map(([k,l])=>`<fieldset><legend>${l}</legend>${input(k+'Kcal','Calories','number','min="1" max="10000"')}${input(k+'Protein','Protéines (g)','number','min="0" max="500"')}</fieldset>`).join('')}
      <button class="btn btn-primary" type="submit">Calculer et enregistrer la cible du jour</button></form><output id="hybrid-target-result" aria-live="polite"></output></details>
      <details><summary>5. Récupération · mon journal</summary><form id="hybrid-recovery">
      ${input('date','Date','date','required')}${input('sleepHours','Sommeil en heures (facultatif)','number','min="0" max="24" step="0.25"')}
      ${input('fatigue','Fatigue 0–10 (facultatif)','number','min="0" max="10"')}${input('soreness','Courbatures 0–10 (facultatif)','number','min="0" max="10"')}
      <label>Douleur<select name="pain"><option value="unknown">Non renseigné</option><option value="none">Non</option><option value="present">Oui</option></select></label>${area('notes','Observations — facultatif',1500)}
      <button class="btn btn-primary" type="submit">Enregistrer la récupération</button></form><output id="hybrid-recovery-result" aria-live="polite"></output></details>
      <p class="muted small">Les brouillons non enregistrés restent uniquement en mémoire et sont effacés à la déconnexion.</p>`;
    document.querySelector('#view-settings')?.prepend(card);
    card.querySelectorAll('input[type=date]').forEach(x=>{x.value=domain.localDate();});
    bind();
  }
  function bindAction(selector,event,action,resultId) {
    card.querySelector(selector).addEventListener(event,async e=>{
      e.preventDefault();const element=e.currentTarget;
      if(card.dataset.busy) return;
      const activeCard=card;
      let token;
      try {token=store.capture();activeCard.dataset.busy='1';activeCard.setAttribute('aria-busy','true');await action(element,token);}
      catch(err) {if(!token || store.isCurrent(token)) output(resultId,err.message || 'Action impossible');}
      finally {delete activeCard.dataset.busy;activeCard.removeAttribute('aria-busy');}
    });
  }
  async function save(collection,id,payload,token) {
    const key=`${collection}/${id}`;
    // Fetch revision before editing only once; a concurrent editor then causes conflict.
    if(!revisions.has(key)) {const old=await repo.load(collection,id);if(!store.isCurrent(token)) throw new Error('Compte modifié');revisions.set(key,old?.revision ?? 0);}
    const saved=await repo.save(collection,id,payload,revisions.get(key));
    if(!store.isCurrent(token)) throw new Error('Compte modifié');
    revisions.set(key,saved.revision);store.write(token,key,payload);return saved;
  }
  function bind() {
    bindAction('#hybrid-profile','submit',async(form,token)=>{
      const v=values(form),data=new FormData(form);let goals=data.getAll('goals');
      domain.requireThat(goals.includes(v.priority),'Coche aussi l’objectif choisi comme priorité');
      goals=[v.priority,...goals.filter(x=>x !== v.priority)];
      const p=domain.validateQuestionnaire({...v,goals,days:data.getAll('days').map(Number),adult:v.adult==='on',aiConsent:v.aiConsent==='on',minutes:n(v.minutes),strengthDays:n(v.strengthDays),runDays:n(v.runDays)});
      const result=domain.coachReadiness(p);await save('coachProfiles','main',p,token);
      output('hybrid-profile-result',`Questionnaire enregistré dans l’émulateur.\n${result.reasons.join('\n') || 'Réponses complètes pour préparer une proposition.'}\nCoach IA non connecté : aucun programme généré.`);
    },'hybrid-profile-result');
    bindAction('#hybrid-load-profile','click',async(_,token)=>{
      const saved=await repo.load('coachProfiles','main');if(!store.isCurrent(token)) return;
      if(!saved) {output('hybrid-profile-result','Aucun questionnaire enregistré.');return;}
      revisions.set('coachProfiles/main',saved.revision);
      const form=card.querySelector('#hybrid-profile');form.reset();
      for(const [key,value] of Object.entries(saved.payload)) {
        if(['goals','days'].includes(key)) form.querySelectorAll(`[name="${key}"]`).forEach(el=>{el.checked=value.map(String).includes(el.value);});
        else if(form.elements[key]) {if(form.elements[key].type==='checkbox') form.elements[key].checked=value;else form.elements[key].value=value;}
      }
      form.elements.priority.value=saved.payload.goals[0];output('hybrid-profile-result','Questionnaire rechargé.');
    },'hybrid-profile-result');
    bindAction('#hybrid-set','submit',async form=>{
      const v=values(form);sets=domain.summarizeSets([...sets,{...v,reps:n(v.reps),loadKg:n(v.loadKg),rpe:n(v.rpe)}]).sets;renderSets();
    },'hybrid-strength-result');
    card.querySelector('#hybrid-undo-set').onclick=()=>{if(card.dataset.busy) return;sets.pop();renderSets();};
    bindAction('#hybrid-strength-save','submit',async(form,token)=>{
      const v=values(form),summary=domain.summarizeSets(sets);await repo.saveStrength({id:strengthId,date:domain.validDate(v.date),name:domain.text(v.name,120,'Séance'),summary});
      if(!store.isCurrent(token)) return;
      sets=[];strengthId=crypto.randomUUID();renderSets();output('hybrid-strength-result','Séance enregistrée dans l’historique de l’émulateur. Recharge l’application pour actualiser les anciennes cartes.');
    },'hybrid-strength-result');
    bindAction('#hybrid-import','submit',async(form,token)=>{
      preview=null;card.querySelector('#hybrid-import-confirm').disabled=true;
      const file=form.elements.file.files[0];domain.requireThat(file && file.size <= 500000,'Fichier JSON requis, maximum 500 Ko');
      const source=JSON.parse(await file.text());const loaded=await repo.loadCalendar();if(!store.isCurrent(token)) return;
      calendar=loaded;preview=domain.previewCalendarImport(source,calendar);
      output('hybrid-calendar-preview',`${preview.added} nouvelle(s) séance(s).\n`+preview.rows.map(r=>`${r.record.date} · ${r.record.title} · ${r.action==='add'?'ajouter':'conserver'}`).join('\n'));
      card.querySelector('#hybrid-import-confirm').disabled=false;
    },'hybrid-calendar-result');
    bindAction('#hybrid-import-confirm','click',async(_,token)=>{
      domain.requireThat(preview,'Prévisualise un calendrier');const added=await repo.importCalendar(preview);
      if(!store.isCurrent(token)) return;
      calendar=await repo.loadCalendar();if(!store.isCurrent(token)) return;
      preview=null;card.querySelector('#hybrid-import-confirm').disabled=true;output('hybrid-calendar-result',`${added} séance(s) enregistrée(s) ; ${calendar.length} au calendrier.`);
    },'hybrid-calendar-result');
    bindAction('#hybrid-calendar-load','click',async(_,token)=>{const loaded=await repo.loadCalendar();if(!store.isCurrent(token)) return;calendar=loaded;output('hybrid-calendar-result',calendar.map(s=>`${s.date} · ${s.title} · ${s.status}`).join('\n') || 'Aucune séance.');},'hybrid-calendar-result');
    bindAction('#hybrid-target','submit',async(form,token)=>{
      const v=values(form),targets={};for(const k of domain.DAY_TYPES) if(v[k+'Kcal'] !== '') targets[k]={kcal:n(v[k+'Kcal']),proteinG:n(v[k+'Protein'])};
      const activities=await repo.loadCalendar();if(!store.isCurrent(token)) return;
      const result=domain.dailyTarget({date:v.date,activities,targets});
      if(!result.target) {output('hybrid-target-result',result.reason);return;}
      await save('nutritionTargets',v.date,{date:v.date,type:result.type,...result.target},token);
      output('hybrid-target-result',`${targetLabels[result.type]} : ${result.target.kcal} kcal · ${result.target.proteinG} g de protéines. Cible enregistrée ; raccordement au journal historique à finaliser.`);
    },'hybrid-target-result');
    bindAction('#hybrid-recovery','submit',async(form,token)=>{
      const v=values(form),result=domain.recoverySummary({...v,sleepHours:n(v.sleepHours),fatigue:n(v.fatigue),soreness:n(v.soreness)});
      await save('dailyRecovery',v.date,result.record,token);output('hybrid-recovery-result',`${result.message}\n${result.missing.length} champ(s) non renseigné(s).`);
    },'hybrid-recovery-result');
  }
  function renderSets() {
    const list=card.querySelector('#hybrid-sets');list.replaceChildren();
    for(const s of sets) {const li=document.createElement('li');li.textContent=`${s.exercise} · ${s.reps} répétitions · ${s.loadKg ?? 'charge non calculée'}${s.loadKg===null?'':' kg'} · ${s.kind==='work'?'travail':'échauffement'}`;list.append(li);}
    if(sets.length) {const summary=domain.summarizeSets(sets);output('hybrid-strength-result',`${summary.workSets} séries de travail · ${summary.knownVolumeKg} kg de volume externe connu · ${summary.unknownVolumeSets} séries au volume non calculable`);}
  }
  onAuthStateChanged(auth,user=>{
    store.switchUser(user?.uid ?? null);preview=null;calendar=[];sets=[];revisions=new Map();strengthId=crypto.randomUUID();
    card?.remove();card=null;
    if(user) mount();
  });
}
