// src/utils/syncStatus.js
// Tracks last user activity for the sync status display on the dashboard.
// Writes to AsyncStorage first (offline-safe), then Firebase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { DB_PATHS, dbPath } from '../shared/schema';

/**
 * Updates the lastActivity timestamp locally and in Firebase.
 */
export const updateLastActivity = async () => {
  const user = getAuth().currentUser;
  const timestamp = new Date().toISOString();

  try {
    await AsyncStorage.setItem('lastActivity', timestamp);
    if (user) {
      await set(ref(db, dbPath(DB_PATHS.USER_SYNC, user.uid)), {
        lastActivity: timestamp,
      });
    }
  } catch (err) {
    // Non-blocking — local timestamp is the priority
    console.warn('Failed to update sync timestamp:', err.message);
  }
};

/**
 * Gets the last sync time from AsyncStorage.
 */
export const getLastActivity = async () => {
  try {
    return await AsyncStorage.getItem('lastActivity');
  } catch (err) {
    console.warn('Failed to read sync timestamp:', err.message);
    return null;
  }
};
