import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { isLoopback, selectFirebaseConfig } from "./hybrid/environment.mjs";

// 1) Va dans Firebase Console > Paramètres du projet > Tes applications > SDK setup and configuration.
// 2) Remplace les valeurs ci-dessous par celles de TON projet Firebase.
// Ce bloc n'est pas un mot de passe : il sert à identifier ton projet côté navigateur.

const productionConfig = {
  apiKey: "AIzaSyCz61po0m3qVv09QlPhY6_q7D95UFY53yY",
  authDomain: "laeti-fit-tracker.firebaseapp.com",
  projectId: "laeti-fit-tracker",
  storageBucket: "laeti-fit-tracker.firebasestorage.app",
  messagingSenderId: "536939261716",
  appId: "1:536939261716:web:271c719ec09169f6c89c01",
  measurementId: "G-8PM7H3TEC1"
};

export const isLocalDevelopment = isLoopback(globalThis.location?.hostname);
export const firebaseConfig = selectFirebaseConfig(productionConfig, globalThis.location?.hostname);
// Configure the default app before any consumer obtains Auth/Firestore.
// A missing emulator never falls back to the real project.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (isLocalDevelopment) {
  connectAuthEmulator(getAuth(firebaseApp), "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(firebaseApp), "127.0.0.1", 8080);
}
