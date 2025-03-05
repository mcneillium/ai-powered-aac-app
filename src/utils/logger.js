// src/utils/logger.js
import { getAuth } from 'firebase/auth';
import { ref, push } from 'firebase/database';
import * as Device from 'expo-device';
import { db } from 'firebaseConfig'; // Ensure relative path is correct

/**
 * Logs an event with extended metadata to the "userLogs" node.
 * @param {string} action - Description of the event.
 * @param {Object} [metadata={}] - Additional data for context.
 */
export function logEvent(action, metadata = {}) {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  // Gather additional device info if available.
  const deviceInfo = {
    model: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
  };

  const logsRef = ref(db, 'userLogs');
  push(logsRef, {
    userId: currentUser ? currentUser.uid : null,
    action,
    timestamp: Date.now(),
    deviceInfo, // Include device info in every log
    ...metadata,
  });
}
