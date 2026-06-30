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

  walker.setAttribute("aria-label", "Illustration FitFlow : femme en marche dynamique");
  walker.innerHTML = `
    <svg class="fitflow-walker-svg" viewBox="0 0 180 180" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="walkSkin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F7B7A3" />
          <stop offset="1" stop-color="#D98976" />
        </linearGradient>
        <linearGradient id="walkTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#EF6F91" />
          <stop offset="1" stop-color="#F7A8B8" />
        </linearGradient>
        <linearGradient id="walkLeg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7E97A6" />
          <stop offset="1" stop-color="#1F2937" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="158" rx="56" ry="9" fill="rgba(31,41,55,.12)" />
      <path d="M128 38c-7-19-33-22-46-6-12 14-8 35 6 41 16 7 38-7 40-35Z" fill="#3F3140" />
      <circle cx="100" cy="45" r="18" fill="url(#walkSkin)" />
      <path d="M83 41c8-20 35-18 42 0-14-9-26-6-42 0Z" fill="#3F3140" />
      <path d="M88 68c9-7 26-7 35 2l-7 42H91L88 68Z" fill="url(#walkTop)" />
      <path d="M91 74c-13 7-23 19-30 34" fill="none" stroke="url(#walkSkin)" stroke-width="10" stroke-linecap="round" />
      <path d="M118 76c13 8 23 19 31 33" fill="none" stroke="url(#walkSkin)" stroke-width="10" stroke-linecap="round" />
      <path d="M94 109c-6 14-16 25-32 37" fill="none" stroke="url(#walkLeg)" stroke-width="12" stroke-linecap="round" />
      <path d="M111 109c7 12 17 22 32 31" fill="none" stroke="url(#walkLeg)" stroke-width="12" stroke-linecap="round" />
      <path d="M63 146c-9 2-15 1-21-3" fill="none" stroke="#1F2937" stroke-width="7" stroke-linecap="round" />
      <path d="M143 140c8 3 15 3 22 0" fill="none" stroke="#1F2937" stroke-width="7" stroke-linecap="round" />
      <path d="M88 111h29" stroke="#D9577F" stroke-width="5" stroke-linecap="round" />
      <path d="M55 113c-5 5-10 6-15 4" stroke="#EF6F91" stroke-width="5" stroke-linecap="round" fill="none" />
      <path d="M149 111c6 2 11 1 15-3" stroke="#EF6F91" stroke-width="5" stroke-linecap="round" fill="none" />
      <circle cx="139" cy="35" r="5" fill="#FFD6DE" />
      <circle cx="49" cy="54" r="4" fill="#F7A8B8" />
      <path d="M38 130c18-13 38-18 61-15 21 3 37 12 52 29" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round" />
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
