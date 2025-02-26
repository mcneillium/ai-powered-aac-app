// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// from your Firebase console > Project settings
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_APP.firebaseapp.com',
  databaseURL: 'https://YOUR_APP.firebaseio.com',
  projectId: 'YOUR_APP',
  storageBucket: 'YOUR_APP.appspot.com',
  messagingSenderId: '...',
  appId: '...'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
