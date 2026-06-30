import { firebaseConfig } from "./firebase-config.js";

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const weekStartISO = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  now.setDate(now.getDate() - day + 1);
  return now.toISOString().slice(0, 10);
};

const qs = (selector) => document.querySelector(selector);

const isConfigReady = () =>
  firebaseConfig?.apiKey &&
  !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));

function setupFirebase() {
  if (!isConfigReady()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
}

const firebase = setupFirebase();

function injectWalkIllustration() {
  const walker = qs(".walker");
  if (!walker) return;

  walker.setAttribute("aria-label", "Illustration FitFlow : chemin de progression et mouvement");
  walker.innerHTML = `
    <svg class="fitflow-walker-svg fitflow-progress-svg" viewBox="0 0 220 180" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="progressSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FFF7F8" />
          <stop offset="1" stop-color="#FFE8EE" />
        </linearGradient>
        <linearGradient id="progressPath" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F7A8B8" />
          <stop offset="1" stop-color="#EF6F91" />
        </linearGradient>
        <linearGradient id="progressAccent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7E97A6" />
          <stop offset="1" stop-color="#1F2937" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#5C4956" flood-opacity=".18" />
        </filter>
      </defs>

      <circle cx="170" cy="34" r="24" fill="#FFF6CF" opacity=".95" />
      <circle cx="170" cy="34" r="34" fill="#FFF6CF" opacity=".24" />
      <path d="M20 132C58 102 91 95 122 106c28 10 45 31 78 21" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="18" stroke-linecap="round" />
      <path d="M20 132C58 102 91 95 122 106c28 10 45 31 78 21" fill="none" stroke="url(#progressPath)" stroke-width="8" stroke-linecap="round" stroke-dasharray="8 15" />

      <g filter="url(#softShadow)">
        <circle cx="43" cy="118" r="14" fill="#FFFFFF" />
        <circle cx="43" cy="118" r="7" fill="#EF6F91" />
        <circle cx="90" cy="101" r="14" fill="#FFFFFF" />
        <path d="M84 101l4 5 9-11" fill="none" stroke="#7EBD93" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="137" cy="112" r="14" fill="#FFFFFF" />
        <path d="M131 112l4 5 9-11" fill="none" stroke="#7EBD93" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <g class="progress-shoe" filter="url(#softShadow)">
        <path d="M114 78c12 4 24 11 34 23 5 6 12 9 22 8l10-1c6 0 11 4 11 9 0 6-5 10-12 10h-55c-15 0-26-7-32-20l-5-12c-3-7 0-14 7-17 6-3 13-3 20 0Z" fill="#FFFFFF" />
        <path d="M96 88c14 8 27 19 38 33" fill="none" stroke="url(#progressAccent)" stroke-width="8" stroke-linecap="round" />
        <path d="M134 121h45" stroke="#1F2937" stroke-width="6" stroke-linecap="round" />
        <path d="M121 92c12 5 23 13 33 25" fill="none" stroke="#EF6F91" stroke-width="5" stroke-linecap="round" />
        <path d="M130 98l-11 8M140 106l-11 8M150 114l-10 7" stroke="#F7A8B8" stroke-width="4" stroke-linecap="round" />
      </g>

      <path d="M43 64h69" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".65" />
      <path d="M34 78h43" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".48" />
      <path d="M35 150h153" stroke="rgba(31,41,55,.12)" stroke-width="9" stroke-linecap="round" />
    </svg>
  `;
}

const fallbackMessages = [
  {
    title: "Objectif du jour",
    text: "Aujourd’hui, on avance avec douceur et intention 🌸",
    subtitle: "Une petite action suffit pour garder l’élan."
  },
  {
    title: "Régularité",
    text: "La régularité bat la perfection, surtout les jours ordinaires ✨",
    subtitle: "Choisis une action simple et fais-la bien."
  },
  {
    title: "Énergie douce",
    text: "Marche, muscu, nutrition : chaque brique compte dans ta progression 💪",
    subtitle: "FitFlow garde le cap avec toi."
  },
  {
    title: "Progression",
    text: "Ce n’est pas une journée parfaite qui compte, c’est la tendance 🌿",
    subtitle: "Continue à construire, tranquillement."
  }
];

function deterministicPick(items) {
  const seed = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const index = Number(seed) % items.length;
  return items[index];
}

function sum(entries, field) {
  return entries.reduce((total, entry) => total + Number(entry[field] || 0), 0);
}

async function fetchUserData(user) {
  if (!firebase || !user) return null;
  const uid = user.uid;
  const today = todayISO();
  const weekStart = weekStartISO();

  const [profileSnap, weightsSnap, walksSnap, strengthSnap, nutritionSnap] = await Promise.all([
    getDoc(doc(firebase.db, "users", uid, "profile", "main")),
    getDocs(query(collection(firebase.db, "users", uid, "weights"), orderBy("date", "desc"))),
    getDocs(query(collection(firebase.db, "users", uid, "walks"), orderBy("date", "desc"))),
    getDocs(query(collection(firebase.db, "users", uid, "strengthSessions"), orderBy("date", "desc"))),
    getDocs(query(collection(firebase.db, "users", uid, "nutritionEntries"), orderBy("date", "desc")))
  ]);

  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const weights = weightsSnap.docs.map((d) => d.data());
  const walks = walksSnap.docs.map((d) => d.data());
  const strength = strengthSnap.docs.map((d) => d.data());
  const nutrition = nutritionSnap.docs.map((d) => d.data());

  const latestWeight = Number(weights[0]?.weight || profile.startWeight || 79.5);
  const proteinTarget = Math.round(latestWeight * Number(profile.proteinPerKg || 1.6));

  return {
    today,
    weekStart,
    profile,
    todayWalks: walks.filter((entry) => entry.date === today),
    weekWalks: walks.filter((entry) => entry.date >= weekStart),
    todayStrength: strength.filter((entry) => entry.date === today),
    weekStrength: strength.filter((entry) => entry.date >= weekStart),
    todayNutrition: nutrition.filter((entry) => entry.date === today),
    proteinTarget
  };
}

function buildDataMessage(data) {
  const nutritionCalories = sum(data.todayNutrition, "calories");
  const protein = sum(data.todayNutrition, "protein");
  const walkDistance = sum(data.todayWalks, "distance");
  const strengthDone = data.todayStrength.length > 0;
  const walkDone = walkDistance > 0;
  const proteinRatio = data.proteinTarget ? protein / data.proteinTarget : 1;
  const weekDistance = sum(data.weekWalks, "distance");
  const weekStrengthCount = data.weekStrength.length;

  if (nutritionCalories > 0 && proteinRatio < 0.75) {
    return {
      title: "Priorité récupération",
      text: `Protéines un peu basses aujourd’hui : vise encore environ ${Math.max(0, Math.round(data.proteinTarget - protein))} g pour soutenir tes muscles 💪`,
      subtitle: "Aujourd’hui, pense énergie, protéines et équilibre."
    };
  }

  if (strengthDone && walkDone) {
    return {
      title: "Journée complète",
      text: "Force + mouvement : tu as coché deux piliers importants aujourd’hui 🔥",
      subtitle: "Belle dynamique, pense aussi à bien récupérer."
    };
  }

  if (strengthDone) {
    return {
      title: "Force du jour",
      text: "Tu construis ta force série après série. Garde cette belle régularité 🏋️‍♀️",
      subtitle: "La progression se joue dans les détails."
    };
  }

  if (walkDone) {
    return {
      title: "Élan du jour",
      text: `${walkDistance.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km déjà enregistrés : ton corps aime le mouvement 🌿`,
      subtitle: "Chaque marche entretient ton élan."
    };
  }

  if (weekDistance >= 10 || weekStrengthCount >= 2) {
    return {
      title: "Garde l’élan",
      text: "Ta semaine est déjà lancée : une petite action aujourd’hui suffit pour rester dans le rythme ✨",
      subtitle: "Régularité, douceur et constance."
    };
  }

  if (nutritionCalories > 0) {
    return {
      title: "Nutrition engagée",
      text: "Tu as commencé ton suivi du jour : continue simplement repas après repas 🍽️",
      subtitle: "Les petites données donnent une grande vision."
    };
  }

  return deterministicPick(fallbackMessages);
}

function applyMessage(message) {
  const title = qs("#motivation-title");
  const text = qs("#motivation-text");
  const subtitle = qs("#view-dashboard .topbar p");

  if (title) title.textContent = message.title;
  if (text) text.textContent = message.text;
  if (subtitle) subtitle.textContent = message.subtitle;
}

async function refreshCoach(user) {
  try {
    if (!user || !firebase) {
      applyMessage(deterministicPick(fallbackMessages));
      return;
    }
    const data = await fetchUserData(user);
    applyMessage(buildDataMessage(data));
  } catch (error) {
    console.warn("Coach d’accueil non mis à jour :", error);
    applyMessage(deterministicPick(fallbackMessages));
  }
}

function initHomeCoach() {
  injectWalkIllustration();
  applyMessage(deterministicPick(fallbackMessages));

  if (!firebase) return;

  onAuthStateChanged(firebase.auth, (user) => {
    refreshCoach(user);
    window.addEventListener("focus", () => refreshCoach(user));
  });
}

initHomeCoach();
