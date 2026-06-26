import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtNumber = (value, decimals = 1) =>
  Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const fmtInt = (value) => Math.round(Number(value || 0)).toLocaleString("fr-FR");

const fmtDateShort = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDayLetter = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 1).toUpperCase();
};

const isConfigReady = () =>
  firebaseConfig?.apiKey &&
  !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));

const SAMPLE_PROFILE = {
  firstname: "Laeti",
  startWeight: 105,
  targetWeight: 65,
  height: 1.63,
  startDate: "2026-01-01",
  stepLength: 0.56
};

const SAMPLE_WALKS = [
  { date:"2026-06-25", distance:4.07, duration:82, incline:5.24, arms:"partial", calories:345, steps:7270, speed:3.0, comment:"Canicule, avant muscu…" },
  { date:"2026-06-24", distance:5.12, duration:100, incline:1.29, arms:"none", calories:412, steps:9143, speed:3.1, comment:"" },
  { date:"2026-06-22", distance:6.00, duration:120, incline:5.24, arms:"partial", calories:501, steps:10727, speed:3.0, comment:"" },
  { date:"2026-06-21", distance:4.93, duration:100, incline:5.24, arms:"partial", calories:436, steps:8804, speed:3.0, comment:"" },
  { date:"2026-06-20", distance:0, duration:0, incline:0, arms:"none", calories:0, steps:0, speed:0, comment:"Repos" },
  { date:"2026-06-19", distance:2.31, duration:46, incline:1.29, arms:"none", calories:287, steps:4125, speed:3.0, comment:"" },
  { date:"2026-06-18", distance:2.00, duration:40, incline:5.24, arms:"partial", calories:364, steps:3571, speed:3.0, comment:"" }
];

const SAMPLE_WEIGHTS = [
  { date:"2026-03-28", weight:84.7, comment:"" },
  { date:"2026-04-08", weight:83.2, comment:"" },
  { date:"2026-04-18", weight:82.5, comment:"" },
  { date:"2026-04-28", weight:80.9, comment:"" },
  { date:"2026-05-08", weight:79.8, comment:"" },
  { date:"2026-05-29", weight:79.5, comment:"" },
  { date:"2026-06-25", weight:79.5, comment:"" }
];

let firebase = null;
let state = {
  user: null,
  profile: structuredClone(SAMPLE_PROFILE),
  walks: structuredClone(SAMPLE_WALKS),
  weights: structuredClone(SAMPLE_WEIGHTS),
  strengthSessions: [
    { date:"2026-06-23", duration:45 },
    { date:"2026-06-25", duration:50 },
    { date:"2026-06-26", duration:40 }
  ],
  lastSummary: null,
  mode: "demo"
};

function setupFirebase() {
  if (!isConfigReady()) return null;
  const app = initializeApp(firebaseConfig);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    provider: new GoogleAuthProvider()
  };
}

firebase = setupFirebase();

function storageKey(name) {
  const uid = state.user?.uid || "demo";
  return `fitflow:${uid}:${name}`;
}

function loadLocal() {
  state.profile = JSON.parse(localStorage.getItem(storageKey("profile")) || "null") || structuredClone(SAMPLE_PROFILE);
  state.walks = JSON.parse(localStorage.getItem(storageKey("walks")) || "null") || structuredClone(SAMPLE_WALKS);
  state.weights = JSON.parse(localStorage.getItem(storageKey("weights")) || "null") || structuredClone(SAMPLE_WEIGHTS);
  state.strengthSessions = JSON.parse(localStorage.getItem(storageKey("strength")) || "null") || state.strengthSessions;
}

function saveLocal() {
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("walks"), JSON.stringify(state.walks));
  localStorage.setItem(storageKey("weights"), JSON.stringify(state.weights));
  localStorage.setItem(storageKey("strength"), JSON.stringify(state.strengthSessions));
}

async function loadRemote() {
  if (!firebase || !state.user) {
    loadLocal();
    return;
  }

  const userRoot = doc(firebase.db, "users", state.user.uid);
  const profileRef = doc(firebase.db, "users", state.user.uid, "profile", "main");
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    await setDoc(userRoot, {
      email: state.user.email || null,
      displayName: state.user.displayName || null,
      createdAt: serverTimestamp()
    }, { merge: true });

    await setDoc(profileRef, {
      ...SAMPLE_PROFILE,
      firstname: state.user.displayName?.split(" ")?.[0] || SAMPLE_PROFILE.firstname,
      updatedAt: serverTimestamp()
    });
  }

  state.profile = profileSnap.exists()
    ? { ...SAMPLE_PROFILE, ...profileSnap.data() }
    : { ...SAMPLE_PROFILE, firstname: state.user.displayName?.split(" ")?.[0] || SAMPLE_PROFILE.firstname };

  const walksSnap = await getDocs(query(collection(firebase.db, "users", state.user.uid, "walks"), orderBy("date", "desc")));
  state.walks = walksSnap.docs.map((d) => ({ id:d.id, ...d.data() }));

  const weightsSnap = await getDocs(query(collection(firebase.db, "users", state.user.uid, "weights"), orderBy("date", "asc")));
  state.weights = weightsSnap.docs.map((d) => ({ id:d.id, ...d.data() }));

  if (!state.walks.length) state.walks = structuredClone(SAMPLE_WALKS);
  if (!state.weights.length) state.weights = structuredClone(SAMPLE_WEIGHTS);
}

async function addWalk(walk) {
  state.walks = [walk, ...state.walks].sort((a,b) => b.date.localeCompare(a.date));

  if (firebase && state.user) {
    await addDoc(collection(firebase.db, "users", state.user.uid, "walks"), {
      ...walk,
      createdAt: serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

async function addWeight(weightEntry) {
  state.weights = [...state.weights, weightEntry].sort((a,b) => a.date.localeCompare(b.date));

  if (firebase && state.user) {
    await addDoc(collection(firebase.db, "users", state.user.uid, "weights"), {
      ...weightEntry,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(firebase.db, "users", state.user.uid, "profile", "main"), {
      ...state.profile,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    saveLocal();
  }
}

function currentWeight() {
  return [...state.weights].sort((a,b) => b.date.localeCompare(a.date))[0]?.weight || state.profile.startWeight;
}

function previousWeight() {
  const sorted = [...state.weights].sort((a,b) => b.date.localeCompare(a.date));
  return sorted[1]?.weight || sorted[0]?.weight || state.profile.startWeight;
}

function weightProgressPercent() {
  const total = state.profile.startWeight - state.profile.targetWeight;
  const done = state.profile.startWeight - currentWeight();
  return Math.max(0, Math.min(100, (done / total) * 100));
}

function weekRange(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return { monday, sunday };
}

function isInCurrentWeek(iso) {
  const { monday, sunday } = weekRange();
  const date = new Date(`${iso}T12:00:00`);
  return date >= monday && date <= sunday;
}

function getWeekWalks() {
  const weekWalks = state.walks.filter((walk) => isInCurrentWeek(walk.date));
  return weekWalks.length ? weekWalks : state.walks.slice(0, 7);
}

function calcWalk(distance, duration, incline, arms) {
  const weight = currentWeight();
  const speed = duration > 0 ? distance / (duration / 60) : 0;
  const steps = Math.round((distance * 1000) / state.profile.stepLength);

  let armsFactor = 1;
  if (arms === "partial") armsFactor = 0.85;
  if (arms === "full") armsFactor = 0.70;

  const intensity = (0.78 + Number(incline || 0) * 0.09) * armsFactor;
  const calories = Math.round(distance * weight * intensity);

  return {
    speed: Number(speed.toFixed(1)),
    steps,
    calories
  };
}

function navigate(viewName) {
  qsa(".view").forEach((view) => view.classList.remove("active"));
  qs(`#view-${viewName}`)?.classList.add("active");

  qsa(".bottom-nav button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === viewName || (viewName === "walk-form" && btn.dataset.nav === "add"));
  });

  render();
}

function showScreen(name) {
  qsa(".screen").forEach((screen) => screen.classList.remove("active"));
  qs(`#screen-${name}`)?.classList.add("active");
}

function renderDashboard() {
  const profile = state.profile;
  const weight = currentWeight();
  const left = profile.targetWeight - weight;
  const weekWalks = getWeekWalks();

  qs("#user-firstname").textContent = profile.firstname || "Laeti";
  qs("#dash-current-weight").textContent = fmtNumber(weight, 1);
  qs("#dash-target-weight").textContent = fmtNumber(profile.targetWeight, 1);
  qs("#dash-weight-left").textContent = `${fmtNumber(left, 1)} kg`;
  qs("#dash-progress").style.width = `${weightProgressPercent()}%`;

  const distance = weekWalks.reduce((sum, walk) => sum + Number(walk.distance || 0), 0);
  const steps = weekWalks.reduce((sum, walk) => sum + Number(walk.steps || 0), 0);
  const calories = weekWalks.reduce((sum, walk) => sum + Number(walk.calories || 0), 0);

  qs("#week-distance").textContent = `${fmtNumber(distance, 1)} km`;
  qs("#week-steps").textContent = fmtInt(steps);
  qs("#week-calories").textContent = fmtInt(calories);
  qs("#week-strength").textContent = state.strengthSessions.length;
}

function renderWalkList() {
  const container = qs("#walk-list-items");
  container.innerHTML = "";

  state.walks
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .forEach((walk) => {
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div class="avatar">🚶</div>
        <div>
          <strong>${fmtDateShort(walk.date)}</strong>
          <small>${fmtNumber(walk.distance, 2)} km • ${walk.duration || 0} min • ${fmtInt(walk.calories)} kcal</small>
        </div>
        <div class="right">
          ↑ ${fmtNumber(walk.incline || 0, 2)}%
          <span>${walk.arms === "partial" ? "Partiel" : walk.arms === "full" ? "Appuyés" : "Non"}</span>
        </div>
      `;
      container.appendChild(card);
    });
}

function renderBars(selector, items, metric, unit = "") {
  const container = qs(selector);
  container.innerHTML = "";
  const max = Math.max(1, ...items.map((item) => Number(item[metric] || 0)));

  items.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    const height = Math.max(3, (Number(item[metric] || 0) / max) * 118);
    bar.innerHTML = `
      <b>${Number(item[metric] || 0) ? fmtNumber(item[metric], metric === "distance" ? 1 : 0) : "0"}</b>
      <div style="height:${height}px"></div>
      <span>${fmtDayLetter(item.date)}</span>
    `;
    container.appendChild(bar);
  });
}

function renderWalkCharts() {
  const items = state.walks
    .slice()
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(-7);

  renderBars("#distance-bars", items, "distance", "km");
  renderBars("#calorie-bars", items, "calories", "kcal");

  qs("#distance-total").textContent = `Total : ${fmtNumber(items.reduce((s,w) => s + Number(w.distance || 0), 0), 1)} km`;
  qs("#calorie-total").textContent = `Total : ${fmtInt(items.reduce((s,w) => s + Number(w.calories || 0), 0))} kcal`;
}

function renderWeight() {
  const weight = currentWeight();
  const previous = previousWeight();
  qs("#weight-current").textContent = fmtNumber(weight, 1);
  qs("#weight-target").textContent = fmtNumber(state.profile.targetWeight, 1);
  qs("#weight-progress").style.width = `${weightProgressPercent()}%`;
  qs("#weight-delta").textContent = `${fmtNumber(weight - previous, 1)} kg`;

  renderWeightLine();
  renderWeightList();
}

function renderWeightLine() {
  const svg = qs("#weight-line");
  const weights = state.weights.slice().sort((a,b) => a.date.localeCompare(b.date));
  const values = weights.map((w) => Number(w.weight));
  const min = Math.min(...values, state.profile.targetWeight) - 1;
  const max = Math.max(...values, state.profile.startWeight) + 1;
  const pad = 28;
  const width = 320;
  const height = 180;

  const x = (i) => pad + (i / Math.max(1, weights.length - 1)) * (width - pad * 2);
  const y = (v) => height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);

  const points = weights.map((w, i) => `${x(i)},${y(w.weight)}`).join(" ");
  const last = weights[weights.length - 1];

  svg.innerHTML = `
    <line x1="${pad}" y1="${y(state.profile.targetWeight)}" x2="${width - pad}" y2="${y(state.profile.targetWeight)}" stroke="#f1d1a6" stroke-dasharray="5 5" />
    <polyline points="${points}" fill="none" stroke="#FF8A00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${weights.map((w, i) => `<circle cx="${x(i)}" cy="${y(w.weight)}" r="4" fill="#FF8A00" />`).join("")}
    <text x="${width - pad - 40}" y="${y(last.weight) - 10}" fill="#222" font-size="18" font-weight="800">${fmtNumber(last.weight, 1)}</text>
  `;
}

function renderWeightList() {
  const container = qs("#weight-list-items");
  container.innerHTML = "";
  state.weights.slice().sort((a,b) => b.date.localeCompare(a.date)).forEach((entry) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div class="avatar">⚖️</div>
      <div>
        <strong>${fmtDateShort(entry.date)}</strong>
        <small>${entry.comment || "Poids enregistré"}</small>
      </div>
      <div class="right">${fmtNumber(entry.weight, 1)} kg</div>
    `;
    container.appendChild(card);
  });
}

function renderSettings() {
  qs("#settings-target").textContent = fmtNumber(state.profile.targetWeight, 1);
  qs("#settings-start").textContent = fmtNumber(state.profile.startWeight, 1);
  qs("#settings-height").textContent = fmtNumber(state.profile.height, 2);
  qs("#settings-date").textContent = fmtDateShort(state.profile.startDate);
  qs("#settings-step").textContent = fmtNumber(state.profile.stepLength, 2);
}

function renderSummary() {
  if (!state.lastSummary) return;
  qs("#summary-list").innerHTML = `
    <div><dt>Distance</dt><dd>${fmtNumber(state.lastSummary.distance, 2)} km</dd></div>
    <div><dt>Durée</dt><dd>${fmtInt(state.lastSummary.duration)} min</dd></div>
    <div><dt>Vitesse moyenne</dt><dd>${fmtNumber(state.lastSummary.speed, 1)} km/h</dd></div>
    <div><dt>Pas estimés</dt><dd>${fmtInt(state.lastSummary.steps)} pas</dd></div>
    <div><dt>Calories actives</dt><dd>${fmtInt(state.lastSummary.calories)} kcal</dd></div>
    <div><dt>Poids utilisé</dt><dd>${fmtNumber(currentWeight(), 1)} kg</dd></div>
  `;
}

function render() {
  renderDashboard();
  renderWalkList();
  renderWalkCharts();
  renderWeight();
  renderSettings();
  renderSummary();
}

function bindEvents() {
  qs("#btn-google").addEventListener("click", async () => {
    if (!firebase) {
      state.mode = "demo";
      state.user = { uid:"demo", displayName:"Laeti", email:null };
      loadLocal();
      showScreen("app");
      navigate("dashboard");
      return;
    }

    try {
      await signInWithPopup(firebase.auth, firebase.provider);
    } catch (error) {
      alert(`Connexion impossible : ${error.message}`);
    }
  });

  qsa("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.nav));
  });

  qsa("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.open));
  });

  qsa("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.back));
  });

  qsa(".bottom-nav button").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.nav));
  });

  qsa(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const group = tab.closest(".view");
      group.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      group.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      qs(`#${tab.dataset.tab}`).classList.add("active");
    });
  });

  const walkForm = qs("#walk-form");
  const walkComment = walkForm.elements.comment;
  walkForm.elements.date.value = todayISO();
  walkComment.addEventListener("input", () => {
    qs("#walk-comment-count").textContent = walkComment.value.length;
  });

  walkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const raw = Object.fromEntries(new FormData(walkForm).entries());
    const distance = Number(raw.distance);
    const duration = Number(raw.duration);
    const incline = Number(raw.incline);
    const computed = calcWalk(distance, duration, incline, raw.arms);

    const walk = {
      date: raw.date,
      distance,
      duration,
      incline,
      arms: raw.arms,
      comment: raw.comment || "",
      ...computed
    };

    await addWalk(walk);
    state.lastSummary = walk;
    walkForm.reset();
    walkForm.elements.date.value = todayISO();
    navigate("summary");
  });

  const weightForm = qs("#weight-form");
  const weightComment = weightForm.elements.comment;
  weightForm.elements.date.value = todayISO();
  weightComment.addEventListener("input", () => {
    qs("#weight-comment-count").textContent = weightComment.value.length;
  });

  weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const raw = Object.fromEntries(new FormData(weightForm).entries());
    const entry = {
      date: raw.date,
      weight: Number(raw.weight),
      comment: raw.comment || ""
    };

    await addWeight(entry);
    weightForm.reset();
    weightForm.elements.date.value = todayISO();
    navigate("weight");
  });

  qsa("#btn-signout, #btn-signout-top").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (firebase && state.user) await signOut(firebase.auth);
      state.user = null;
      showScreen("login");
    });
  });
}

async function init() {
  bindEvents();

  if (!firebase) {
    qs("#login-note").textContent = "Mode démo : ajoute ta configuration Firebase pour synchroniser tes données.";
    qs("#btn-google").textContent = "Continuer en mode démo";
    loadLocal();
    render();
    return;
  }

  onAuthStateChanged(firebase.auth, async (user) => {
    if (!user) {
      showScreen("login");
      return;
    }

    state.user = user;
    state.mode = "firebase";
    await loadRemote();
    showScreen("app");
    navigate("dashboard");
  });
}

init();
