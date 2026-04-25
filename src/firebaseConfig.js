import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * DEFENSIVE_ENVIRONMENT_CONFIG
 * Utilizing Vite's import.meta.env to prevent credential leakage 
 * and separate data environments.
 */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase Node
const app = initializeApp(firebaseConfig);

// Export Core Services
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * ENVIRONMENT_ROUTING
 * Automatically switches collections based on the build environment.
 * Local: dev_users | Vercel/Production: users
 */
export const isDev = import.meta.env.DEV;
export const USERS_COLLECTION = isDev ? 'dev_users' : 'users';

export default app;