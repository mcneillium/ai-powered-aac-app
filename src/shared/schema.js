/**
 * Shared Firebase Realtime Database schema constants.
 *
 * Used by both the mobile app and the web dashboard to ensure
 * consistent data paths and field names.
 *
 * IMPORTANT: Any changes here must be reflected in both codebases.
 *   - App:       ai-powered-aac-app/src/shared/schema.js
 *   - Dashboard: ai-powered-aac-dashboard/src/shared/schema.js
 *
 * Database structure:
 *   users/{uid}              - User profiles (name, email, role, createdAt)
 *   userSettings/{uid}       - Per-user app settings (theme, gridSize, speech)
 *   userLogs/{pushId}        - Activity logs (flat collection, scoped by targetUserId)
 *   sessions/{uid}/{id}      - Session records per user
 *   feedback/{uid}/{pushId}  - User feedback submissions
 *   fineTuneMetrics/{pushId} - AI model fine-tune metrics
 *   userSync/{uid}           - Last activity timestamps for sync status
 */

// ── Firebase Realtime Database Paths ──
// These are the ACTUAL paths used in reads/writes. Always reference these.

export const DB_PATHS = {
  USERS: 'users',                        // users/{uid}
  USER_SETTINGS: 'userSettings',         // userSettings/{uid}
  USER_LOGS: 'userLogs',                 // userLogs/{pushId}
  SESSIONS: 'sessions',                  // sessions/{uid}/{id}
  FEEDBACK: 'feedback',                  // feedback/{uid}/{pushId}
  FINE_TUNE_METRICS: 'fineTuneMetrics',  // fineTuneMetrics/{pushId}
  USER_SYNC: 'userSync',                // userSync/{uid}
};

// Legacy alias — prefer DB_PATHS for new code
export const COLLECTIONS = DB_PATHS;

// ── User Roles ──

export const ROLES = {
  USER: 'user',
  CAREGIVER: 'caregiver',
  ADMIN: 'admin',
};

// ── User Profile Schema ──
// Path: users/{uid}

export const USER_FIELDS = {
  NAME: 'name',
  EMAIL: 'email',
  ROLE: 'role',
  CREATED_AT: 'createdAt',
  CAREGIVER_ID: 'caregiverId',  // UID of assigned caregiver
};

// ── User Settings Schema ──
// Path: userSettings/{uid}

export const SETTINGS_DEFAULTS = {
  theme: 'light',         // 'light' | 'dark' | 'highContrast'
  gridSize: 3,            // 2 | 3 | 4
  contrast: false,
  speechRate: 1.0,        // 0.5 - 1.5
  speechPitch: 1.0,       // 0.5 - 1.5
  speechVoice: null,      // string | null (system default)
};

// ── Log Entry Schema ──
// Path: userLogs/{pushId}

export const LOG_FIELDS = {
  TARGET_USER_ID: 'targetUserId',
  CARER_ID: 'carerId',
  ACTION: 'action',
  TIMESTAMP: 'timestamp',
  LEVEL: 'level',           // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  SESSION_ID: 'sessionId',
  DEVICE_INFO: 'deviceInfo',
};

// ── Log Action Types ──

export const LOG_ACTIONS = {
  EMOTION_SELECTED: 'Emotion selected',
  EMOTION_SPOKEN: 'Emotion spoken',
  EMOTION_SAVED: 'Emotion saved',
  USER_LOGGED_IN: 'User logged in',
  LOGIN_ERROR: 'Login error',
  PREDICTION_REQUEST: 'prediction_request',
  PREDICTION_LEARNING: 'prediction_learning',
  MODEL_FINE_TUNING: 'model_fine_tuning',
  LOGS_SYNCED: 'logs_synced',
  ADD_WORD: 'addWord',
  WORD_SPOKEN: 'word_spoken',
  SENTENCE_SPOKEN: 'sentence_spoken',
  BOARD_TAP: 'board_tap',
};

// ── Log Levels ──

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// ── Feedback Schema ──
// Path: feedback/{uid}/{pushId}

export const FEEDBACK_FIELDS = {
  NAME: 'name',
  EMAIL: 'email',
  ROLE: 'role',
  FEEDBACK: 'feedback',
  TIMESTAMP: 'timestamp',
};

// ── Fine-Tune Metrics Schema ──
// Path: fineTuneMetrics/{pushId}

export const FINE_TUNE_FIELDS = {
  EPOCH: 'epoch',
  LOSS: 'loss',
  ACCURACY: 'accuracy',
  TIMESTAMP: 'timestamp',
};

// ── Theme Values ──

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  HIGH_CONTRAST: 'highContrast',
};

// ── Emotions (from app) ──

export const EMOTIONS = [
  'Happy', 'Sad', 'Angry', 'Excited',
  'Scared', 'Calm', 'Tired', 'Surprised',
];

/**
 * Helper to build a Firebase ref path.
 * @param {...string} segments - Path segments
 * @returns {string} Joined path
 */
export function dbPath(...segments) {
  return segments.filter(Boolean).join('/');
}

/**
 * Helper: get user display name with fallback
 */
export function getUserDisplayName(user) {
  return user?.name || user?.email || 'Unknown User';
}

/**
 * Helper: check if a user record is a caregiver or admin
 */
export function isCaregiver(user) {
  return user?.role === ROLES.CAREGIVER || user?.role === ROLES.ADMIN;
}

/**
 * Helper: get the correct user ID field from a log entry.
 * The app writes targetUserId; legacy/test writes userId.
 */
export function getLogUserId(log) {
  return log?.targetUserId || log?.userId || null;
}

/**
 * Helper: get the caregiver ID from a log entry.
 */
export function getLogCarerId(log) {
  return log?.carerId || null;
}
