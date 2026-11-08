import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID, messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID };
const configured = Boolean(config.apiKey && config.projectId && config.appId);
export const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
if (app && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth!, 'http://127.0.0.1:9099', {disableWarnings:true});
  connectFirestoreEmulator(db!, '127.0.0.1', 8080);
}
export const firebaseConfigured = configured;
