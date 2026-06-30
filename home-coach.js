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

function currentSeasonConfig() {
  const month = new Date().getMonth() + 1;

  if (month >= 3 && month <= 5) {
    return {
      key: "spring",
      label: "Printemps",
      emoji: "🌸",
      accent: "#EF6F91",
      accentSoft: "#FFD6DE",
      secondary: "#7EBD93",
      background: "#FFF7F8",
      message: "Élan doux",
      decoration: `
        <circle cx="51" cy="50" r="4" fill="#EF6F91" opacity=".85" />
        <circle cx="58" cy="45" r="3" fill="#F7A8B8" opacity=".9" />
        <circle cx="65" cy="51" r="4" fill="#EF6F91" opacity=".65" />
        <path d="M55 61c9 6 19 6 30 0" stroke="#7EBD93" stroke-width="4" stroke-linecap="round" fill="none" />
      `
    };
  }

  if (month >= 6 && month <= 8) {
    return {
      key: "summer",
      label: "Été",
      emoji: "☀️",
      accent: "#EF6F91",
      accentSoft: "#FFF6CF",
      secondary: "#F7A8B8",
      background: "#FFF7F8",
      message: "Énergie solaire",
      decoration: `
        <circle cx="64" cy="48" r="16" fill="#FFF6CF" />
        <circle cx="64" cy="48" r="25" fill="#FFF6CF" opacity=".28" />
        <path d="M64 17v10M64 69v10M33 48h10M85 48h10M42 26l7 7M79 63l7 7M86 26l-7 7M49 63l-7 7" stroke="#F7A8B8" stroke-width="4" stroke-linecap="round" opacity=".85" />
      `
    };
  }

  if (month >= 9 && month <= 11) {
    return {
      key: "autumn",
      label: "Automne",
      emoji: "🍂",
      accent: "#D9826B",
      accentSoft: "#FFE6D8",
      secondary: "#C79A6B",
      background: "#FFF7F2",
      message: "Régularité",
      decoration: `
        <path d="M48 50c13-17 29-15 37 0-15 1-25 9-29 24-9-6-12-14-8-24Z" fill="#D9826B" opacity=".82" />
        <path d="M58 59c8 1 15-2 23-10" stroke="#8B5E4A" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55" />
        <path d="M87 76c8 5 18 5 27 0" stroke="#C79A6B" stroke-width="4" stroke-linecap="round" fill="none" opacity=".72" />
      `
    };
  }

  return {
    key: "winter",
    label: "Hiver",
    emoji: "❄️",
    accent: "#7E97A6",
    accentSoft: "#EEF3F6",
    secondary: "#C7C0D4",
    background: "#F8FAFC",
    message: "Douceur active",
    decoration: `
      <path d="M71 33c-13 6-18 22-10 35 7 12 22 16 34 9-17 1-29-10-29-26 0-8 2-14 5-18Z" fill="#C7C0D4" opacity=".85" />
      <circle cx="48" cy="48" r="3" fill="#7E97A6" opacity=".75" />
      <circle cx="96" cy="39" r="3" fill="#7E97A6" opacity=".6" />
      <path d="M101 73l5 5 5-5M106 68v15" stroke="#7E97A6" stroke-width="3" stroke-linecap="round" opacity=".78" />
    `
  };
}

function injectWalkIllustration() {
  const walker = qs(".walker");
  if (!walker) return;

  const season = currentSeasonConfig();
  walker.setAttribute("aria-label", `Illustration FitFlow : cercle de progression ${season.label}`);
  walker.innerHTML = `
    <svg class="fitflow-walker-svg fitflow-season-ring-svg" viewBox="0 0 220 180" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="seasonRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${season.accentSoft}" />
          <stop offset="1" stop-color="${season.accent}" />
        </linearGradient>
        <linearGradient id="seasonInner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FFFFFF" />
          <stop offset="1" stop-color="${season.background}" />
        </linearGradient>
        <filter id="seasonShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#5C4956" flood-opacity=".16" />
        </filter>
      </defs>

      <circle cx="110" cy="90" r="68" fill="url(#seasonInner)" filter="url(#seasonShadow)" />
      <circle cx="110" cy="90" r="56" fill="none" stroke="#FFFFFF" stroke-width="18" opacity=".78" />
      <circle cx="110" cy="90" r="56" fill="none" stroke="url(#seasonRing)" stroke-width="11" stroke-linecap="round" stroke-dasharray="240 352" transform="rotate(-92 110 90)" />
      <circle cx="110" cy="90" r="39" fill="#FFFFFF" opacity=".82" />

      <g class="season-decoration">
        ${season.decoration}
      </g>

      <g filter="url(#seasonShadow)">
        <circle cx="58" cy="124" r="15" fill="#FFFFFF" />
        <text x="58" y="130" text-anchor="middle" font-size="17">👣</text>
        <circle cx="110" cy="30" r="15" fill="#FFFFFF" />
        <text x="110" y="36" text-anchor="middle" font-size="17">🍽️</text>
        <circle cx="162" cy="124" r="15" fill="#FFFFFF" />
        <text x="162" y="130" text-anchor="middle" font-size="17">🏋️</text>
      </g>

      <text x="110" y="83" text-anchor="middle" font-size="12" font-family="Poppins, Arial" font-weight="700" fill="#7C7280">${season.label}</text>
      <text x="110" y="103" text-anchor="middle" font-size="18" font-family="Poppins, Arial" font-weight="800" fill="#1F2937">FitFlow</text>
      <text x="110" y="121" text-anchor="middle" font-size="10" font-family="Poppins, Arial" font-weight="600" fill="${season.accent}">${season.message}</text>

      <path d="M38 156h144" stroke="rgba(31,41,55,.10)" stroke-width="8" stroke-linecap="round" />
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
