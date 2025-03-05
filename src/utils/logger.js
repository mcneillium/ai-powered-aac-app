// src/utils/logger.js
import { getAuth } from 'firebase/auth';
import { ref, push } from 'firebase/database';
import { db } from 'firebaseConfig';

/**
 * Logs an event to the "userLogs" node in Firebase.
 * @param {string} action - A description of the event.
 * @param {Object} [metadata={}] - Additional data about the event.
 */
export function logEvent(action, metadata = {}) {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const logsRef = ref(db, 'userLogs');
  push(logsRef, {
    userId: currentUser ? currentUser.uid : null,
    action,
    timestamp: Date.now(),
    ...metadata
  });
}
