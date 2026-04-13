import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ── Configuración de Firebase ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCK8YDDrYnOOltgBUPIW5_lRzDOaFxwUSI",
  authDomain:        "estacionamiento-app-2ef31.firebaseapp.com",
  projectId:         "estacionamiento-app-2ef31",
  storageBucket:     "estacionamiento-app-2ef31.appspot.com",
  messagingSenderId: "334251980249",
  appId:             "1:334251980249:web:27c821c8d3ccd7c93455c8",
};

// ── Inicializar app (evita duplicados en recarga) ────────────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ── Auth CON persistencia real (fix del warning de AsyncStorage) ─────────────
// Esto hace que la sesión se mantenga entre cierres de la app
let auth: ReturnType<typeof initializeAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Si ya fue inicializado (hot reload), obtener la instancia existente
  const { getAuth } = require("firebase/auth");
  auth = getAuth(app);
}

export { auth };

// ── Firestore ─────────────────────────────────────────────────────────────────
export const db = getFirestore(app);

export default app;
