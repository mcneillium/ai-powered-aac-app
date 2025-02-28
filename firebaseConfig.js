// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBZS_Bfl7Bj4axlFt8Pg3HebYzAbrqBDQs',
  authDomain: 'commai-b98fe.firebaseapp.com',
  // Updated databaseURL:
  databaseURL: 'https://commai-b98fe-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'commai-b98fe',
  storageBucket: 'commai-b98fe.appspot.com',
  messagingSenderId: '...',
  appId: '...'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
