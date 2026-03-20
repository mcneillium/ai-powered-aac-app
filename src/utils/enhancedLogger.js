// src/utils/enhancedLogger.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db } from '../../firebaseConfig';
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
  
  try {
    // Get current logs
    const storedLogsString = await AsyncStorage.getItem('userInteractionLog');
    let storedLogs = storedLogsString ? JSON.parse(storedLogsString) : [];
    
    // Add queued logs
    const logsToAdd = [...logQueue];
    logQueue = []; // Clear the queue
    
    storedLogs = [...storedLogs, ...logsToAdd];
    
    // Store logs back to AsyncStorage
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify(storedLogs));
    
    // If we're at the threshold, try to sync to Firebase
    if (storedLogs.length >= MAX_CACHED_LOGS && isOnline) {
      await syncLogsToFirebase();
    }
  } catch (error) {
    console.error('Error processing log queue:', error);
    // Put the logs back in the queue if operation failed
    logQueue = [...logQueue, ...logQueue];
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
    
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    // Determine user IDs
    const targetUserId = metadata.targetUserId || (currentUser ? currentUser.uid : null);
    const carerId = currentUser ? currentUser.uid : null;
    
    // Get device info
    const deviceInfo = await getDeviceInfo();
    
    // Create the log entry
    const logEntry = {
      targetUserId,
      carerId,
      action,
      level: levelUpper,
      timestamp: Date.now(),
      sessionId: await getSessionId(),
      deviceInfo,
      ...metadata
    };
    
    // Add to in-memory queue
    logQueue.push(logEntry);
    
    // Try to add log immediately to Firebase if online
    if (isOnline && currentUser) {
      try {
        const logsRef = ref(db, 'userLogs');
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
 * Get basic device info to include with logs
 */
async function getDeviceInfo() {
  try {
    // This would typically use React Native's Platform and other APIs
    // to get actual device info, but we'll use a placeholder for now
    return {
      platform: 'React Native',
      appVersion: '1.0.0',
      // Add more device info as needed
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return { platform: 'unknown' };
  }
}

/**
 * Sync locally stored logs to Firebase
 */
export async function syncLogsToFirebase() {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
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
    const logsRef = ref(db, 'userLogs');
    const promises = storedLogs.map(log => {
      const newLogRef = push(logsRef);
      return set(newLogRef, {
        ...log,
        synced: true,
        syncTimestamp: serverTimestamp()
      });
    });
    
    await Promise.all(promises);
    
    // Clear local logs after successful sync
    await AsyncStorage.setItem('userInteractionLog', JSON.stringify([]));
    
    console.log('✅ Logs successfully synced to Firebase');
    
    // Log the sync itself (directly to Firebase)
    const syncLogRef = push(ref(db, 'userLogs'));
    await set(syncLogRef, {
      action: 'logs_synced',
      count: storedLogs.length,
      timestamp: Date.now(),
      carerId: auth.currentUser.uid,
      serverTimestamp: serverTimestamp()
    });
    
    return true;
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