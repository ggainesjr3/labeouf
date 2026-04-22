import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <--- MUST HAVE THIS

const firebaseConfig = {
  apiKey: "AIzaSyD86WY22HmqsOKWfuthmbzEAa70Diy62VQ",
  authDomain: "labeouf-7235e.firebaseapp.com",
  projectId: "labeouf-7235e",
  storageBucket: "labeouf-7235e.firebasestorage.app",
  messagingSenderId: "1024921234885",
  appId: "1:1024921234885:web:42102ff57f5922a453efac"
};

const app = initializeApp(firebaseConfig);

// These are "Named Exports" - they must match what you import in App.jsx
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <--- MUST HAVE THIS

export default app;