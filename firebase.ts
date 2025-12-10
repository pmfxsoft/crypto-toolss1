import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Access env with type assertion to bypass missing ImportMeta type definition
const env = (import.meta as any).env || {};

// =================================================================
// اطلاعات پروژه فایربیس
// برای فعال‌سازی ذخیره‌سازی، مقادیر زیر را با اطلاعات کنسول فایربیس خود جایگزین کنید.
// =================================================================
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);