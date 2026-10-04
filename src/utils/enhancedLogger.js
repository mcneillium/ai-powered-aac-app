// src/utils/enhancedLogger.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import packageJson from '../../package.json';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db, auth as cloudAuth } from '../../firebaseConfig';
import NetInfo from '@react-native-community/netinfo';

// Maximum number of logs to store locally before auto-sync
const MAX_CACHED_LOGS = 50;

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (only logs at this level or higher are stored/sent)
let currentLogLevel = LOG_LEVELS.INFO;

// The only fields database.rules.json permits under userLogs/$uid/$logId.
// Anything else is rejected by `"$other": {".validate": false}` — and because
// syncLogsToFirebase only clears AsyncStorage once every entry resolves, one
// rejected entry wedges log sync permanently. Filter here rather than let the
// write fail.
const ALLOWED_LOG_FIELDS = [
  'action', 'timestamp', 'level', 'sessionId', 'targetUserId', 'carerId',
  'synced', 'syncTimestamp', 'serverTimestamp', 'count', 'error', 'deviceInfo',
];

function pickAllowedLogFields(source) {
  const picked = {};
  for (const key of ALLOWED_LOG_FIELDS) {
    if (source && source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}

// A write the database rules reject will be rejected identically on every
// retry. Left in the queue it becomes a poison pill: syncLogsToFirebase only
// clears AsyncStorage once the whole batch resolves, so one such entry blocks
// every later log on that device indefinitely. Rejected entries are therefore
// dropped, while transient failures (offline, timeout, server error) stay
// queued. Anything not clearly a rules rejection counts as transient, so an
// unrecognised error costs a retry rather than the entry.
const PERMISSION_ERROR_CODES = [
  'PERMISSION_DENIED',
  'permission-denied',
  'permission_denied',
];

function isPermissionError(error) {
  if (!error) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  if (PERMISSION_ERROR_CODES.includes(code)) return true;
  const message = typeof error.message === 'string' ? error.message : '';
  return message.toUpperCase().includes('PERMISSION_DENIED');
}

// In-memory queue for logs waiting to be written to AsyncStorage
let logQueue = [];
let isProcessingQueue = false;
let isOnline = true;

// Initialize connectivity listener
export function initLogger() {
  // Set up network state listener
  NetInfo.addEventListener(state => {
    const previousState = isOnline;
    isOnline = state.isConnected && state.isInternetReachable;
    
    // If we just came back online, try to sync logs
    if (!previousState && isOnline) {
      console.log('📶 Network connection restored. Attempting to sync logs...');
      syncLogsToFirebase().catch(err => 
        console.error('Failed to sync logs after reconnection:', err)
      );
    }
  });
  
  // Set log level from storage if available
  AsyncStorage.getItem('logLevel')
    .then(level => {
      if (level !== null) {
        currentLogLevel = parseInt(level);
      }
    })
    .catch(err => console.error('Error loading log level:', err));
    
  return true;
}

/**
 * Set the current log level
 * @param {string} level - The log level ('debug', 'info', 'warn', 'error')
 */
export function setLogLevel(level) {
  const levelUpper = level.toUpperCase();
  if (LOG_LEVELS[levelUpper] !== undefined) {
    currentLogLevel = LOG_LEVELS[levelUpper];
    AsyncStorage.setItem('logLevel', currentLogLevel.toString())
      .catch(err => console.error('Error saving log level:', err));
  }
}

/**
 * Process the log queue by writing to AsyncStorage
 */
async function processLogQueue() {
  if (isProcessingQueue || logQueue.length === 0) return;
  
  isProcessingQueue = true;

  let logsToAdd = [];
  try {
    // Get current logs
    const storedLogsString = await AsyncStorage.getItem('userInteractionLog');
    let storedLogs = storedLogsString ? JSON.parse(storedLogsString) : [];

    // Add queued logs
    logsToAdd = [...logQueue];
    logQueue = []; // Clear the queue
    
    storedLogs = [...storedLogs, ...logsToAdd];

    // Cap local log storage at 500 entries to prevent unbounded growth.
    // Oldest entries are dropped first.
    const MAX_LOCAL_LOGS = 500;
    if (storedLogs.length > MAX_LOCAL_LOGS) {
      storedLogs = storedLogs.slice(storedLogs.length - MAX_LOCAL_LOGS);
    }

    // Store logs back to AsyncStorage
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify(storedLogs));
    
    // If we're at the threshold, try to sync to Firebase
    if (storedLogs.length >= MAX_CACHED_LOGS && isOnline) {
      await syncLogsToFirebase();
    }
  } catch (error) {
    console.error('Error processing log queue:', error);
    // Put the unwritten logs back at the front of the queue so they retry
    logQueue = [...logsToAdd, ...logQueue];
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Enhanced log event function that handles online/offline scenarios
 * and adds more metadata to logs
 * 
 * @param {string} action - The action being logged
 * @param {Object} metadata - Additional metadata about the event
 * @param {string} level - Log level (debug, info, warn, error)
 * @returns {Promise<Object>} The created log entry
 */
export async function logEvent(action, metadata = {}, level = 'info') {
  try {
    const levelUpper = level.toUpperCase();
    const levelValue = LOG_LEVELS[levelUpper] || LOG_LEVELS.INFO;
    
    // Only log if at or above current level
    if (levelValue < currentLogLevel) {
      return null;
    }
    
    const auth = cloudAuth || { currentUser: null }; // null when Firebase is not configured
    const currentUser = auth.currentUser;
    
    // Determine user IDs
    const targetUserId = metadata.targetUserId || (currentUser ? currentUser.uid : null);
    const carerId = currentUser ? currentUser.uid : null;
    
    // Get device info
    const deviceInfo = await getDeviceInfo();
    
    // Create the log entry. Filtered metadata goes first so this function's own
    // values always win — a caller cannot replace action/timestamp/deviceInfo
    // with something the rules' type validators would then reject.
    const logEntry = {
      ...pickAllowedLogFields(metadata),
      targetUserId,
      carerId,
      action,
      level: levelUpper,
      timestamp: Date.now(),
      sessionId: await getSessionId(),
      deviceInfo,
    };
    
    // Add to in-memory queue
    logQueue.push(logEntry);
    
    // Try to add log immediately to Firebase if online.
    // Anonymous (guest) sessions never sync logs — guest data stays local.
    if (isOnline && currentUser && !currentUser.isAnonymous) {
      try {
        const logsRef = ref(db, `userLogs/${currentUser.uid}`);
        await push(logsRef, {
          ...logEntry,
          serverTimestamp: serverTimestamp()
        });
        
        // Successfully logged to Firebase, no need to queue
        return logEntry;
      } catch (firebaseError) {
        console.log('Failed to log directly to Firebase, queueing for later:', firebaseError.message);
        // Continue to process the queue and store locally
      }
    }
    
    // Process the queue (store in AsyncStorage)
    processLogQueue().catch(err => 
      console.error('Error in processLogQueue:', err)
    );
    
    return logEntry;
  } catch (error) {
    console.error('Error in logEvent:', error);
    return null;
  }
}

/**
 * Get a unique session ID for grouping logs
 */
async function getSessionId() {
  try {
    let sessionId = await AsyncStorage.getItem('currentSessionId');
    
    if (!sessionId) {
      // Generate a new session ID
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      await AsyncStorage.setItem('currentSessionId', sessionId);
    }
    
    return sessionId;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return 'unknown_session';
  }
}

/**
 * Get basic device info to include with logs.
 * Intentionally coarse — no device identifiers, only platform + app version.
 */
async function getDeviceInfo() {
  return {
    platform: Platform.OS,
    appVersion: packageJson.version,
  };
}

/**
 * Sync locally stored logs to Firebase
 */
export async function syncLogsToFirebase() {
  try {
    const auth = cloudAuth || { currentUser: null }; // null when Firebase is not configured
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      console.log('Not logged in, skipping sync');
      return false;
    }
    
    // Check network status before attempting sync
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      console.log('No network connection, skipping sync');
      return false;
    }
    
    // Get logs from AsyncStorage
    const storedLogsString = await AsyncStorage.getItem('userInteractionLog');
    if (!storedLogsString) {
      console.log('No logs to sync');
      return true;
    }
    
    const storedLogs = JSON.parse(storedLogsString);
    if (storedLogs.length === 0) {
      return true;
    }
    
    console.log(`Syncing ${storedLogs.length} logs to Firebase...`);
    
    // Create a batch of logs in Firebase
    const logsRef = ref(db, `userLogs/${auth.currentUser.uid}`);
    // Filter again on the way out: entries left in AsyncStorage by an older
    // build predate the whitelist above, and one unknown field here would
    // reject the whole batch and leave it queued forever.
    const promises = storedLogs.map(log => {
      const newLogRef = push(logsRef);
      return set(newLogRef, {
        ...pickAllowedLogFields(log),
        synced: true,
        syncTimestamp: serverTimestamp()
      });
    });
    
    // allSettled, not all: one rejection must not discard the outcome of every
    // other entry in the batch. `promises` is index-aligned with `storedLogs`.
    const results = await Promise.allSettled(promises);

    const retryable = [];
    let syncedCount = 0;
    let rejectedCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        syncedCount += 1;
      } else if (isPermissionError(result.reason)) {
        // Unsyncable by construction — drop it rather than block the queue.
        rejectedCount += 1;
        console.warn(
          'Log entry rejected by database rules, dropping it:',
          storedLogs[index] && storedLogs[index].action,
          result.reason && result.reason.message
        );
      } else {
        retryable.push(storedLogs[index]);
      }
    });

    // Keep only what is worth another attempt. This replaces the previous
    // blanket clear, which ran only when every entry succeeded.
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify(retryable));

    if (rejectedCount > 0) {
      console.warn(`Dropped ${rejectedCount} log entr${rejectedCount === 1 ? 'y' : 'ies'} rejected by database rules`);
    }
    if (retryable.length > 0) {
      console.log(`Synced ${syncedCount} logs; ${retryable.length} kept for retry`);
    } else if (syncedCount > 0) {
      console.log('✅ Logs successfully synced to Firebase');
    }

    // Log the sync itself (directly to Firebase). Only when something actually
    // landed — a summary claiming a sync that wrote nothing is worse than none.
    // `count` keeps its field name and type; it now reports entries actually
    // written rather than entries attempted.
    if (syncedCount > 0) {
      const syncLogRef = push(ref(db, `userLogs/${auth.currentUser.uid}`));
      await set(syncLogRef, {
        action: 'logs_synced',
        count: syncedCount,
        timestamp: Date.now(),
        carerId: auth.currentUser.uid,
        serverTimestamp: serverTimestamp()
      });
    }

    return retryable.length === 0;
  } catch (error) {
    console.error('Error syncing logs to Firebase:', error);
    
    // If there was an error, keep the logs locally
    return false;
  }
}

/**
 * Get logs stored locally
 * @param {number} limit - Maximum number of logs to return
 * @param {string} level - Minimum log level to include
 * @returns {Promise<Array>} Array of log entries
 */
export async function getLocalLogs(limit = 100, level = 'info') {
  try {
    const levelValue = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    
    // Get logs from AsyncStorage
    const storedLogsString = await AsyncStorage.getItem('userInteractionLog');
    if (!storedLogsString) {
      return [];
    }
    
    const storedLogs = JSON.parse(storedLogsString);
    
    // Filter by level and limit the results
    return storedLogs
      .filter(log => LOG_LEVELS[log.level || 'INFO'] >= levelValue)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error getting local logs:', error);
    return [];
  }
}

/**
 * Clear local logs
 */
export async function clearLocalLogs() {
  try {
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify([]));
    return true;
  } catch (error) {
    console.error('Error clearing local logs:', error);
    return false;
  }
}

// Handle debug methods
export const logger = {
  debug: (message, metadata = {}) => logEvent(message, metadata, 'debug'),
  info: (message, metadata = {}) => logEvent(message, metadata, 'info'),
  warn: (message, metadata = {}) => logEvent(message, metadata, 'warn'),
  error: (message, metadata = {}) => logEvent(message, metadata, 'error')
};

// Export a default function for backward compatibility
export default logEvent;