import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCK8YDDrYnOOltgBUPIW5_lRzDOaFxwUSI",
  authDomain: "estacionamiento-app-2ef31.firebaseapp.com",
  projectId: "estacionamiento-app-2ef31",
  storageBucket: "estacionamiento-app-2ef31.firebasestorage.app",
  messagingSenderId: "334251980249",
  appId: "1:334251980249:web:27c821c8d3ccd7c93455c8",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;