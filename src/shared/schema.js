/**
 * Shared Firebase Realtime Database schema constants.
 *
 * Used by both the mobile app and the web dashboard to ensure
 * consistent data paths and field names.
 *
 * Database structure:
 *   users/{uid}            - User profiles (name, email, role, createdAt)
 *   sessions/{uid}/{id}    - Session logs per user
 *   logs/{uid}/{id}        - Activity logs per user
 *   feedback/{id}          - User feedback submissions
 *   settings/{uid}         - Per-user app settings
 */

// --- Collection paths ---
export const COLLECTIONS = {
  USERS: 'users',
  SESSIONS: 'sessions',
  LOGS: 'logs',
  FEEDBACK: 'feedback',
  SETTINGS: 'settings',
};

// --- User roles ---
export const ROLES = {
  USER: 'user',
  CAREGIVER: 'caregiver',
  ADMIN: 'admin',
};

// --- User profile fields ---
export const USER_FIELDS = {
  NAME: 'name',
  EMAIL: 'email',
  ROLE: 'role',
  CREATED_AT: 'createdAt',
  ASSIGNED_CAREGIVER: 'assignedCaregiver',
};

// --- Log entry fields ---
export const LOG_FIELDS = {
  ACTION: 'action',
  DETAILS: 'details',
  TIMESTAMP: 'timestamp',
  SESSION_ID: 'sessionId',
};

// --- Feedback fields ---
export const FEEDBACK_FIELDS = {
  MESSAGE: 'message',
  UID: 'uid',
  CREATED_AT: 'createdAt',
  RATING: 'rating',
};

/**
 * Helper to build a Firebase ref path.
 * @param {...string} segments - Path segments
 * @returns {string} Joined path
 */
export function dbPath(...segments) {
  return segments.filter(Boolean).join('/');
}
