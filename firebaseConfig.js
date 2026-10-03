// firebaseConfig.js
// Cloud services are OPTIONAL. Communication (boards, speech, favourites,
// history) is local-first and must keep working when Firebase is missing,
// misconfigured or unreachable. So this module never throws: when the config
// is incomplete or initialisation fails, `db` and `auth` are null and
// `firebaseStatus` explains why. Every consumer must handle null.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Keys without which Auth or the Realtime Database cannot work at all.
const REQUIRED_KEYS = ['apiKey', 'databaseURL', 'projectId', 'appId'];

/**
 * Check a config object. Returns a list of human-readable problems
 * (empty when usable). Exported for tests.
 */
export function validateFirebaseConfig(config) {
  const problems = [];
  const missing = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) problems.push(`missing env vars for: ${missing.join(', ')}`);
  const missingRequired = REQUIRED_KEYS.filter(k => !config[k]);
  if (config.databaseURL && !/^https:\/\/[^\s/]+/.test(config.databaseURL)) {
    problems.push('databaseURL is not a valid https URL');
  }
  return { problems, fatal: missingRequired.length > 0 || problems.some(p => p.startsWith('databaseURL')) };
}

let app = null;
let db = null;
let auth = null;
const firebaseStatus = { available: false, reason: null };

const { problems, fatal } = validateFirebaseConfig(firebaseConfig);
if (problems.length > 0) {
  console.error(
    `Firebase config: ${problems.join('; ')}.\n` +
    'Copy .env.example to .env and fill in your values. ' +
    'Cloud features are disabled; communication still works on this device.'
  );
}

if (fatal) {
  firebaseStatus.reason = 'not-configured';
} else {
  try {
    // 1) Initialize (or reuse) the Firebase App
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    // 2) Realtime Database (throws synchronously on a malformed databaseURL)
    db = getDatabase(app);

    // 3) Auth exactly once. getReactNativePersistence only exists in
    //    Firebase's React Native build; on web the default persistence is used.
    try {
      auth = typeof getReactNativePersistence === 'function'
        ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
        : getAuth(app);
    } catch (e) {
      if (e.code === 'auth/already-initialized') {
        auth = getAuth(app);
      } else {
        throw e;
      }
    }
    firebaseStatus.available = true;
  } catch (e) {
    console.error('Firebase initialisation failed; cloud features disabled:', e?.message || e);
    app = null;
    db = null;
    auth = null;
    firebaseStatus.reason = 'init-failed';
  }
}

/** True when cloud sync, accounts and online AI can be attempted. */
export function isFirebaseAvailable() {
  return firebaseStatus.available;
}

export { db, auth, firebaseStatus };
