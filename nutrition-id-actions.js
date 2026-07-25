import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const qs = (selector) => document.querySelector(selector);
let user = null;
let initialized = false;

const ready = () => firebaseConfig?.apiKey && !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"));
const fb = (() => {
  if (!ready()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
})();

function key(name) {
  return `fitflow:${user?.uid || "demo"}:${name}`;
}

function readLocal(name) {
  return JSON.parse(localStorage.getItem(key(name)) || "[]");
}

function saveLocal(name, value) {
  localStorage.setItem(key(name), JSON.stringify(value));
}

function toast(message) {
  let element = qs("#nutrition-save-toast");
  if (!element) {
    element = document.createElement("div");
    element.id = "nutrition-save-toast";
    element.className = "nutrition-toast";
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.classList.add("active");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => element.classList.remove("active"), 2200);
}

function notifyChanged(source) {
  window.dispatchEvent(new CustomEvent("fitflow:nutrition-data-changed", {
    detail:{ source, entryIdReliable:true }
  }));
}

async function loadEntryById(id) {
  if (!id) return null;
  if (fb && user) {
    const snapshot = await getDoc(doc(fb.db, "users", user.uid, "nutritionEntries", id));
    return snapshot.exists() ? { id:snapshot.id, ...snapshot.data() } : null;
  }
  return readLocal("nutritionEntries").find((entry) => entry.id === id) || null;
}

function buildFavoritePayload(entry) {
  return {
    name:entry.name,
    referenceType:entry.referenceType || "per100",
    unit:entry.unit || (entry.referenceType === "portion" ? "portion" : "g"),
    servingName:entry.servingName || "portion",
    servingWeight:entry.servingWeight || null,
    baseCalories:Number(entry.baseCalories || 0),
    baseProtein:Number(entry.baseProtein || 0),
    baseCarbs:Number(entry.baseCarbs || 0),
    baseFat:Number(entry.baseFat || 0),
    baseFiber:Number(entry.baseFiber || 0),
    defaultQuantity:Number(entry.quantity || (entry.referenceType === "portion" ? 1 : 100))
  };
}

async function addFavoriteByEntry(entry) {
  const favorite = buildFavoritePayload(entry);
  if (fb && user) {
    const snapshot = await getDocs(query(collection(fb.db, "users", user.uid, "foodFavorites"), orderBy("name", "asc")));
    const existing = snapshot.docs
      .map((item) => ({ id:item.id, ...item.data() }))
      .find((item) =>
        item.name?.toLowerCase() === favorite.name?.toLowerCase() &&
        item.referenceType === favorite.referenceType &&
        item.unit === favorite.unit
      );

    if (existing?.id) {
      await updateDoc(doc(fb.db, "users", user.uid, "foodFavorites", existing.id), {
        ...favorite,
        updatedAt:serverTimestamp()
      });
    } else {
      await addDoc(collection(fb.db, "users", user.uid, "foodFavorites"), {
        ...favorite,
        createdAt:serverTimestamp()
      });
    }
    return;
  }

  const favorites = readLocal("foodFavorites");
  const existingIndex = favorites.findIndex((item) =>
    item.name?.toLowerCase() === favorite.name?.toLowerCase() &&
    item.referenceType === favorite.referenceType &&
    item.unit === favorite.unit
  );
  if (existingIndex >= 0) favorites[existingIndex] = { ...favorites[existingIndex], ...favorite };
  else favorites.push({ ...favorite, id:crypto.randomUUID?.() || String(Date.now()) });
  favorites.sort((a, b) => a.name.localeCompare(b.name));
  saveLocal("foodFavorites", favorites);
}

async function deleteEntryById(id) {
  if (fb && user) {
    await deleteDoc(doc(fb.db, "users", user.uid, "nutritionEntries", id));
    return;
  }
  saveLocal("nutritionEntries", readLocal("nutritionEntries").filter((entry) => entry.id !== id));
}

function updateMealCardAfterRemoval(item) {
  const card = item?.closest(".nutrition-meal-card");
  item?.remove();
  const list = card?.querySelector(".nutrition-food-list");
  if (list && !list.querySelector(".nutrition-food-item")) {
    list.innerHTML = `<p class="empty-meal">Aucun aliment pour le moment.</p>`;
  }
}

async function handleClick(event) {
  const favoriteButton = event.target.closest(".favorite-food");
  const deleteButton = event.target.closest(".delete-food");
  const button = favoriteButton || deleteButton;
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const id = button.dataset.entryId || button.closest(".nutrition-food-item")?.dataset.entryId || "";
  if (!id) {
    toast("Identifiant de l’aliment indisponible. Recharge FitFlow puis réessaie.");
    return;
  }

  try {
    const entry = await loadEntryById(id);
    if (!entry) {
      toast("Aliment introuvable");
      return;
    }

    if (favoriteButton) {
      await addFavoriteByEntry(entry);
      toast(`"${entry.name}" ajouté aux favoris ⭐`);
      notifyChanged("favorite-added");
      return;
    }

    if (!confirm(`Supprimer "${entry.name}" ?`)) return;
    button.disabled = true;
    await deleteEntryById(id);
    updateMealCardAfterRemoval(button.closest(".nutrition-food-item"));
    toast("Aliment supprimé ✅");
    notifyChanged("food-deleted");
  } catch (error) {
    console.warn("Action aliment par ID échouée", error);
    button.disabled = false;
    toast("Action impossible pour le moment");
  }
}

function init() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", handleClick, true);
}

if (fb) {
  onAuthStateChanged(fb.auth, (currentUser) => {
    user = currentUser;
    if (user) init();
  });
} else {
  user = { uid:"demo" };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
}
