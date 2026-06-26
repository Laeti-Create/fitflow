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
  updateDoc,
  deleteDoc,
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

const SAMPLE_STRENGTH = [
  { date:"2026-06-23", duration:45, type:"upper", effort:7, comment:"Haut du corps" },
  { date:"2026-06-25", duration:50, type:"lower", effort:8, comment:"Bas du corps" },
  { date:"2026-06-26", duration:40, type:"full", effort:7, comment:"Full body" }
];

const SAMPLE_MEASUREMENTS = [
  { date:"2026-05-01", waist:82, hips:112, thigh:66, arm:31, comment:"" },
  { date:"2026-06-01", waist:79, hips:109, thigh:64, arm:30, comment:"" }
];

let firebase = null;
let state = {
  user: null,
  profile: structuredClone(SAMPLE_PROFILE),
  walks: structuredClone(SAMPLE_WALKS),
  weights: structuredClone(SAMPLE_WEIGHTS),
  strengthSessions: structuredClone(SAMPLE_STRENGTH),
  measurements: structuredClone(SAMPLE_MEASUREMENTS),
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
  state.strengthSessions = JSON.parse(localStorage.getItem(storageKey("strength")) || "null") || structuredClone(SAMPLE_STRENGTH);
  state.measurements = JSON.parse(localStorage.getItem(storageKey("measurements")) || "null") || structuredClone(SAMPLE_MEASUREMENTS);
}

function saveLocal() {
  localStorage.setItem(storageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(storageKey("walks"), JSON.stringify(state.walks));
  localStorage.setItem(storageKey("weights"), JSON.stringify(state.weights));
  localStorage.setItem(storageKey("strength"), JSON.stringify(state.strengthSessions));
  localStorage.setItem(storageKey("measurements"), JSON.stringify(state.measurements));
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

  const strengthSnap = await getDocs(query(collection(firebase.db, "users", state.user.uid, "strengthSessions"), orderBy("date", "desc")));
  state.strengthSessions = strengthSnap.docs.map((d) => ({ id:d.id, ...d.data() }));

  const measurementsSnap = await getDocs(query(collection(firebase.db, "users", state.user.uid, "measurements"), orderBy("date", "asc")));
  state.measurements = measurementsSnap.docs.map((d) => ({ id:d.id, ...d.data() }));

  if (!state.walks.length) state.walks = structuredClone(SAMPLE_WALKS);
  if (!state.weights.length) state.weights = structuredClone(SAMPLE_WEIGHTS);
  if (!state.strengthSessions.length) state.strengthSessions = structuredClone(SAMPLE_STRENGTH);
  if (!state.measurements.length) state.measurements = structuredClone(SAMPLE_MEASUREMENTS);
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
  } else {
    saveLocal();
  }
}

async function addStrength(entry) {
  if (firebase && state.user) {
    const docRef = await addDoc(collection(firebase.db, "users", state.user.uid, "strengthSessions"), {
      ...entry,
      createdAt: serverTimestamp()
    });

    state.strengthSessions = [{ ...entry, id: docRef.id }, ...state.strengthSessions].sort((a,b) => b.date.localeCompare(a.date));
  } else {
    state.strengthSessions = [entry, ...state.strengthSessions].sort((a,b) => b.date.localeCompare(a.date));
    saveLocal();
  }
}

async function deleteStrength(entryId, index) {
  const confirmDelete = confirm("Supprimer cette séance muscu ?");
  if (!confirmDelete) return;

  state.strengthSessions.splice(index, 1);

  if (firebase && state.user && entryId) {
    await deleteDoc(doc(firebase.db, "users", state.user.uid, "strengthSessions", entryId));
  } else {
    saveLocal();
  }

  render();
}

async function updateStrength(entryId, index, updates) {
  state.strengthSessions[index] = {
    ...state.strengthSessions[index],
    ...updates
  };

  if (firebase && state.user && entryId) {
    await updateDoc(doc(firebase.db, "users", state.user.uid, "strengthSessions", entryId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } else {
    saveLocal();
  }

  render();
}

function parseOptionalNumber(value) {
  if (value === null) return null;
  if (String(value).trim() === "") return null;
  return Number(value);
}

async function addMeasurement(entry) {
  state.measurements = [...state.measurements, entry].sort((a,b) => a.date.localeCompare(b.date));

  if (firebase && state.user) {
    await addDoc(collection(firebase.db, "users", state.user.uid, "measurements"), {
      ...entry,
      createdAt: serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

async function saveProfile(profile) {
  state.profile = { ...state.profile, ...profile };

  if (firebase && state.user) {
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
  if (!total) return 0;
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

function getWeekStrength() {
  const weekStrength = state.strengthSessions.filter((entry) => isInCurrentWeek(entry.date));
  return weekStrength.length ? weekStrength : state.strengthSessions.slice(0, 7);
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

function strengthTypeLabel(type) {
  const labels = {
    push: "Poussée",
    pull: "Tirage",
    upper: "Haut du corps",
    lower: "Bas du corps",
    full: "Full body",
    glutes: "Fessiers / jambes",
    core: "Abdos / gainage",
    other: "Autre"
  };
  return labels[type] || "Autre";
}

function navigate(viewName) {
  qsa(".view").forEach((view) => view.classList.remove("active"));
  qs(`#view-${viewName}`)?.classList.add("active");

  qsa(".bottom-nav button").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.nav === viewName ||
      (["walk-form","strength-form","measure-form","weight-form"].includes(viewName) && btn.dataset.nav === "add")
    );
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
  const weekStrength = getWeekStrength();

  qs("#user-firstname").textContent = profile.firstname || "Laeti";
  qs("#dash-current-weight").textContent = fmtNumber(weight, 1);
  qs("#dash-target-weight").textContent = fmtNumber(profile.targetWeight, 1);
  qs("#dash-weight-left").textContent = `${fmtNumber(left, 1)} kg`;
  qs("#dash-progress").style.width = `${weightProgressPercent()}%`;

  const distance = weekWalks.reduce((sum, walk) => sum + Number(walk.distance || 0), 0);
  const steps = weekWalks.reduce((sum, walk) => sum + Number(walk.steps || 0), 0);
  const calories = weekWalks.reduce((sum, walk) => sum + Number(walk.calories || 0), 0);

  let motivation = "Chaque pas te rapproche de ta meilleure version.";

  if (distance >= 20 && weekStrength.length >= 2) {
    motivation = "Semaine solide : tu combines cardio, force et régularité 🔥";
  } else if (distance >= 10) {
    motivation = "Belle régularité sur la marche, continue comme ça 🌿";
  } else if (weekStrength.length >= 2) {
    motivation = "Tes séances muscu construisent ta force, une répétition après l’autre 💪";
  } else if (steps >= 20000) {
    motivation = "Tes pas s’additionnent, et ta progression aussi ✨";
  }

  const motivationText = qs("#motivation-text");
  if (motivationText) motivationText.textContent = motivation;

  qs("#week-distance").textContent = `${fmtNumber(distance, 1)} km`;
  qs("#week-steps").textContent = fmtInt(steps);
  qs("#week-calories").textContent = fmtInt(calories);
  qs("#week-strength").textContent = weekStrength.length;
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

function renderBars(selector, items, metric) {
  const container = qs(selector);
  if (!container) return;
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

  renderBars("#distance-bars", items, "distance");
  renderBars("#calorie-bars", items, "calories");

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
  if (!svg) return;
  const weights = state.weights.slice().sort((a,b) => a.date.localeCompare(b.date));
  if (!weights.length) return;

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
  if (!container) return;
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

function renderStrength() {
  const container = qs("#strength-list-items");
  if (!container) return;
  container.innerHTML = "";

  state.strengthSessions
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const realIndex = state.strengthSessions.findIndex((x) => x === entry);
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div class="avatar">🏋️</div>
        <div>
          <strong>${entry.name || strengthTypeLabel(entry.type)}</strong>
          <small>${fmtDateShort(entry.date)} • ${entry.duration || 0} min • ${entry.totalSets || "-"} séries</small>
          <div class="card-actions">
            <button class="mini-action edit-strength" data-index="${realIndex}" data-id="${entry.id || ""}">Modifier</button>
            <button class="mini-action danger delete-strength" data-index="${realIndex}" data-id="${entry.id || ""}">Supprimer</button>
          </div>
        </div>
        <div class="right">
          ${entry.totalVolume ? fmtInt(entry.totalVolume) + " kg" : "✓"}
          <span>${entry.calories ? fmtInt(entry.calories) + " kcal" : entry.comment || "Séance faite"}</span>
        </div>
      `;
      container.appendChild(card);
    });

  const items = state.strengthSessions.slice().sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  renderBars("#strength-bars", items.map((x) => ({...x, duration: Number(x.duration || 0)})), "duration");
  const total = items.reduce((sum, x) => sum + Number(x.duration || 0), 0);
  const totalEl = qs("#strength-total");
  if (totalEl) totalEl.textContent = `Total : ${fmtInt(total)} min`;
}

function renderMeasurements() {
  const list = qs("#measure-list-items");
  if (!list) return;
  list.innerHTML = "";

  state.measurements
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div class="avatar">📏</div>
        <div>
          <strong>${fmtDateShort(entry.date)}</strong>
          <small>Taille ${fmtNumber(entry.waist, 1)} cm • Hanches ${fmtNumber(entry.hips, 1)} cm • Cuisse ${fmtNumber(entry.thigh, 1)} cm</small>
        </div>
        <div class="right">
          Bras ${fmtNumber(entry.arm, 1)}
          <span>${entry.comment || "Mensurations"}</span>
        </div>
      `;
      list.appendChild(card);
    });

  renderMeasureLine();
}

function renderMeasureLine() {
  const svg = qs("#measure-line");
  if (!svg) return;
  const data = state.measurements.slice().sort((a,b) => a.date.localeCompare(b.date));
  if (!data.length) return;

  const values = data.flatMap((d) => [Number(d.waist || 0), Number(d.hips || 0), Number(d.thigh || 0)].filter(Boolean));
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const pad = 28;
  const width = 320;
  const height = 180;

  const x = (i) => pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2);
  const y = (v) => height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
  const line = (field) => data.map((d, i) => `${x(i)},${y(Number(d[field] || 0))}`).join(" ");

  svg.innerHTML = `
    <polyline points="${line("hips")}" fill="none" stroke="#FF8A00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <polyline points="${line("waist")}" fill="none" stroke="#FFB703" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <polyline points="${line("thigh")}" fill="none" stroke="#5BBE8A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${data.map((d, i) => `<circle cx="${x(i)}" cy="${y(Number(d.waist || 0))}" r="4" fill="#FFB703" />`).join("")}
  `;
}

function renderSettings() {
  qs("#settings-target").textContent = fmtNumber(state.profile.targetWeight, 1);
  qs("#settings-start").textContent = fmtNumber(state.profile.startWeight, 1);
  qs("#settings-height").textContent = fmtNumber(state.profile.height, 2);
  qs("#settings-date").textContent = fmtDateShort(state.profile.startDate);
  qs("#settings-step").textContent = fmtNumber(state.profile.stepLength, 2);

  const form = qs("#profile-form");
  if (form && !form.dataset.loaded) {
    form.elements.firstname.value = state.profile.firstname || "";
    form.elements.targetWeight.value = state.profile.targetWeight || "";
    form.elements.startWeight.value = state.profile.startWeight || "";
    form.elements.height.value = state.profile.height || "";
    form.elements.startDate.value = state.profile.startDate || todayISO();
    form.elements.stepLength.value = state.profile.stepLength || "";
    form.dataset.loaded = "true";
  }
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
  renderStrength();
  renderMeasurements();
  renderSettings();
  renderSummary();
}

function bindEvents() {
  let googleLoginInProgress = false;

  qs("#btn-google").addEventListener("click", async () => {
    if (googleLoginInProgress) return;

    googleLoginInProgress = true;
    const btnGoogle = qs("#btn-google");
    btnGoogle.disabled = true;
    btnGoogle.textContent = "Connexion en cours...";

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
      googleLoginInProgress = false;
      btnGoogle.disabled = false;
      btnGoogle.textContent = "Continuer avec Google";
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

  const strengthForm = qs("#strength-form");
  if (strengthForm) {
    strengthForm.elements.date.value = todayISO();
    strengthForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const raw = Object.fromEntries(new FormData(strengthForm).entries());
      const entry = {
        date: raw.date,
        name: raw.name || "Séance muscu",
        duration: Number(raw.duration),
        totalSets: raw.totalSets ? Number(raw.totalSets) : null,
        totalVolume: raw.totalVolume ? Number(raw.totalVolume) : null,
        calories: raw.calories ? Number(raw.calories) : null,
        type: raw.type,
        effort: Number(raw.effort),
        comment: raw.comment || ""
      };

      await addStrength(entry);
      strengthForm.reset();
      strengthForm.elements.date.value = todayISO();
      navigate("strength");
    });
  }

  const measureForm = qs("#measure-form");
  if (measureForm) {
    measureForm.elements.date.value = todayISO();
    measureForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const raw = Object.fromEntries(new FormData(measureForm).entries());
      const entry = {
        date: raw.date,
        waist: Number(raw.waist),
        hips: Number(raw.hips),
        thigh: Number(raw.thigh),
        arm: Number(raw.arm),
        comment: raw.comment || ""
      };

      await addMeasurement(entry);
      measureForm.reset();
      measureForm.elements.date.value = todayISO();
      navigate("measurements");
    });
  }

  const profileForm = qs("#profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(profileForm).entries());

      await saveProfile({
        firstname: raw.firstname || "Laeti",
        targetWeight: Number(raw.targetWeight),
        startWeight: Number(raw.startWeight),
        height: Number(raw.height),
        startDate: raw.startDate,
        stepLength: Number(raw.stepLength)
      });

      profileForm.dataset.loaded = "";
      alert("Paramètres enregistrés ✅");
      render();
    });
  }

  const strengthList = qs("#strength-list-items");

  if (strengthList) {
    strengthList.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest(".delete-strength");
      const editButton = event.target.closest(".edit-strength");

      if (deleteButton) {
        const index = Number(deleteButton.dataset.index);
        const id = deleteButton.dataset.id || null;
        await deleteStrength(id, index);
        return;
      }

      if (editButton) {
        const index = Number(editButton.dataset.index);
        const id = editButton.dataset.id || null;
        const entry = state.strengthSessions[index];

        const name = prompt("Nom de la séance", entry.name || "");
        if (name === null) return;

        const duration = prompt("Durée en minutes", entry.duration || "");
        if (duration === null) return;

        const totalSets = prompt("Nombre de séries", entry.totalSets || "");
        if (totalSets === null) return;

        const totalVolume = prompt("Volume total en kg", entry.totalVolume || "");
        if (totalVolume === null) return;

        const calories = prompt("Calories", entry.calories || "");
        if (calories === null) return;

        const effort = prompt("Effort /10", entry.effort || "");
        if (effort === null) return;

        const comment = prompt("Commentaire", entry.comment || "");
        if (comment === null) return;

        await updateStrength(id, index, {
          name: name || "Séance muscu",
          duration: Number(duration),
          totalSets: parseOptionalNumber(totalSets),
          totalVolume: parseOptionalNumber(totalVolume),
          calories: parseOptionalNumber(calories),
          effort: Number(effort),
          comment: comment || ""
        });
      }
    });
  }

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
