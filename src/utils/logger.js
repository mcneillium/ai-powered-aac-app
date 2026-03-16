// src/utils/logger.js
import { getAuth } from 'firebase/auth';
import { ref, push } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../firebaseConfig';

export async function logEvent(action, metadata = {}) {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const targetUserId = metadata.targetUserId || (currentUser ? currentUser.uid : null);
  const carerId = currentUser ? currentUser.uid : null;
  
  const logEntry = {
    targetUserId,
    carerId,
    action,
    timestamp: Date.now(),
    ...metadata
  };

  // Push to Firebase
  const logsRef = ref(db, 'userLogs');
  try {
    await push(logsRef, logEntry);
  } catch (firebaseError) {
    console.warn('Failed to push log to Firebase:', firebaseError.message);
  }

  // Also save to AsyncStorage
  try {
    const storedLogs = await AsyncStorage.getItem('userInteractionLog');
    let logsArray = storedLogs ? JSON.parse(storedLogs) : [];
    logsArray.push(logEntry);
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify(logsArray));
  } catch (error) {
    console.error('Error saving log to AsyncStorage:', error);
  }
}
