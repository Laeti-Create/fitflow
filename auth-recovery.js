import { firebaseConfig } from "./firebase-config.js";
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const BUTTON_SELECTOR = "#btn-google";
let loginInProgress = false;

function isFirebaseReady() {
  return Boolean(
    firebaseConfig?.apiKey &&
    !Object.values(firebaseConfig).some((value) => String(value).includes("REMPLACE_MOI"))
  );
}

function getFirebaseAuth() {
  const app = getApps()[0] || initializeApp(firebaseConfig);
  return getAuth(app);
}

function restoreButton(button) {
  loginInProgress = false;
  if (!button) return;
  button.disabled = false;
  button.textContent = "Continuer avec Google";
}

function friendlyMessage(error) {
  const code = error?.code || "";

  if (code === "auth/popup-blocked") {
    return "Safari a bloqué la fenêtre de connexion. Autorise les fenêtres surgissantes pour FitFlow puis réessaie.";
  }

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "La fenêtre Google n’a pas pu terminer la connexion. Ferme les éventuels onglets Firebase ouverts, reviens sur FitFlow puis réessaie.";
  }

  if (code === "auth/web-storage-unsupported") {
    return "Safari empêche l’accès au stockage nécessaire à la connexion. Vérifie que la navigation privée est désactivée puis réessaie.";
  }

  return `Connexion impossible : ${error?.message || "erreur inconnue"}`;
}

async function handleGoogleLogin(event) {
  const button = event.target.closest(BUTTON_SELECTOR);
  if (!button || !isFirebaseReady()) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (loginInProgress) return;
  loginInProgress = true;
  button.disabled = true;
  button.textContent = "Connexion en cours...";

  try {
    const auth = getFirebaseAuth();
    await setPersistence(auth, browserLocalPersistence);
    await auth.authStateReady?.();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("FitFlow Google Auth", error);
    window.alert(friendlyMessage(error));
    restoreButton(button);
  }
}

// Capture permet de neutraliser l’ancien gestionnaire sans modifier le gros app.js.
document.addEventListener("click", handleGoogleLogin, true);

window.addEventListener("pageshow", () => {
  restoreButton(document.querySelector(BUTTON_SELECTOR));
});
