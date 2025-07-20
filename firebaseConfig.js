// firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBZS_Bfl7Bj4axlFt8Pg3HebYzAbrqBDQs',
  authDomain: 'commai-b98fe.firebaseapp.com',
  databaseURL: 'https://commai-b98fe-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'commai-b98fe',
  storageBucket: 'commai-b98fe.appspot.com',
  messagingSenderId: '...',
  appId: '...'
};

// 1) Initialize (or reuse) the Firebase App
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// 2) Initialize Realtime Database (uses databaseURL from config)
export const db = getDatabase(app);

// 3) Initialize Auth exactly once, with AsyncStorage persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  if (e.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw e;
  }
}
export { auth };
