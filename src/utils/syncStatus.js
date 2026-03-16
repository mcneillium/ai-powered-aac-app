// src/utils/syncStatus.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';

/**
 * Updates the lastActivity timestamp locally and in Firebase.
 * @returns {Promise<void>}
 */
export const updateLastActivity = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const timestamp = new Date().toISOString();

  try {
    await AsyncStorage.setItem('lastActivity', timestamp);
    if (user) {
      const db = getDatabase();
      await set(ref(db, `userSync/${user.uid}`), {
        lastActivity: timestamp,
      });
    }
  } catch (err) {
    console.error('Failed to update sync timestamp:', err);
  }
};

/**
 * Gets the last sync time from AsyncStorage.
 * @returns {Promise<string|null>} ISO timestamp string, or null if not found.
 */
export const getLastActivity = async () => {
  try {
    return await AsyncStorage.getItem('lastActivity');
  } catch (err) {
    console.error('Failed to read sync timestamp:', err);
    return null;
  }
};
