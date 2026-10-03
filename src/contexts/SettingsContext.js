// src/contexts/SettingsContext.js
// Offline-first settings: AsyncStorage is the primary store.
// Firebase syncs when available but never blocks the UI.

import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { useAuth } from './AuthContext';
import { DB_PATHS, dbPath } from '../shared/schema';
import { safeParse } from '../utils/safeStorage';
import { effectiveSettings, routeSettingsUpdate, migrateExperience } from './experience';

const SETTINGS_STORAGE_KEY = '@aac_settings';

const defaultSettings = {
  theme: 'light',
  gridSize: 3,
  contrast: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVoice: null, // null = system default
  aiPersonalisationEnabled: true, // learn from user input to improve suggestions
  cloudSuggestionsEnabled: false, // off unless chosen: sends sentence context to the AI backend
  scanMode: 'auto',   // 'auto' | 'step'
  scanSpeed: 1500,     // ms between auto-scan steps
  // Communication preferences — defaults preserve the original board layout
  // and behaviour; users opt in to changes.
  predictionEnabled: true,   // show the word-suggestion strip
  speakWordsOnTap: true,     // speak each word as it is added
  textScale: 1,              // board text size: 1 | 1.25 | 1.5
  showVoiceStyles: true,     // show the voice-style bar on the board
  showScanControls: true,    // show the switch-scanning bar on the board
  compactLayout: false,      // opt-in small-screen layout (never enabled automatically)
  // Voice 2 experience. boardLayout is set by migrateExperience on first
  // read: 'classic' (the familiar board) for existing installs, 'studio' for
  // new ones. uiMode stays null until someone chooses Child or Adult.
  boardLayout: null,         // 'studio' | 'classic'
  uiMode: null,              // null | 'child' | 'adult'
  modeProfiles: null,        // { child: {...}, adult: {...} } per-mode presentation settings
  symbolStyle: 'mixed',      // 'symbols' | 'mixed' | 'text'
  personalLearning: false,   // on-device learning from spoken sentences — off until enabled
  activeContext: null,       // explicitly chosen context panel id, or null
  controlsPosition: 'top',   // 'top' | 'bottom' (one-handed) — new board only
  editLock: false,           // protect Personalise from accidental changes
};

export { defaultSettings };

// Settings that belong to this device only and are never synced: voice ids
// differ between devices and platforms, and the compact layout depends on
// this device's screen. (Keeping them local also means a reset to "default"
// (null), which the Realtime Database stores as a missing key, is not lost.)
export const LOCAL_ONLY_KEYS = ['speechVoice', 'compactLayout', 'boardLayoutSource'];

/** The settings object as written to the cloud. Exported for tests. */
export function toCloudSettings(settings) {
  const out = { ...settings };
  LOCAL_ONLY_KEYS.forEach(k => { delete out[k]; });
  return out;
}

/**
 * The cloud patch for one settings change: only the keys that changed,
 * minus device-only keys and undefined values. Writing a partial patch
 * (Realtime Database update()) means a change made on a fresh device before
 * the first cloud snapshot arrives cannot replace the account's synced
 * settings with this device's defaults. Exported for tests.
 */
export function cloudPatchFor(updates, previous) {
  const patch = toCloudSettings(updates || {});
  Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete patch[k]; });
  // Per-mode settings are written key by key (multi-path update), so two
  // devices changing different modes never overwrite each other.
  if (patch.modeProfiles && typeof patch.modeProfiles === 'object') {
    const prev = (previous && previous.modeProfiles) || {};
    for (const [mode, profile] of Object.entries(patch.modeProfiles)) {
      for (const [k, v] of Object.entries(profile || {})) {
        if (!prev[mode] || prev[mode][k] !== v) patch[`modeProfiles/${mode}/${k}`] = v;
      }
    }
    delete patch.modeProfiles;
  }
  return patch;
}

/**
 * Merge cloud settings into local ones. Cloud values only win when they are
 * real values: a missing, null or non-object snapshot never wipes local
 * settings. Exported for tests.
 */
export function mergeRemoteSettings(local, remote) {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return local;
  const merged = { ...local };
  for (const [key, value] of Object.entries(remote)) {
    if (LOCAL_ONLY_KEYS.includes(key)) continue;
    if (value === null || value === undefined) continue;
    if (key === 'modeProfiles' && typeof value === 'object') {
      // Merge each mode's settings rather than replacing the whole set.
      const profiles = { ...(local.modeProfiles || {}) };
      for (const [mode, profile] of Object.entries(value)) {
        if (profile && typeof profile === 'object') profiles[mode] = { ...(profiles[mode] || {}), ...profile };
      }
      merged.modeProfiles = profiles;
    } else {
      merged[key] = value;
    }
  }
  // An account with synced settings but no board choice belongs to someone
  // who used Voice before Voice 2: keep the familiar board on this device
  // unless they already chose here.
  if (!remote.boardLayout && local.boardLayoutSource === 'new-install' && Object.keys(remote).length > 0) {
    merged.boardLayout = 'classic';
    merged.boardLayoutSource = 'existing-account';
  }
  return merged;
}

export const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  updateSettings: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Latest settings, so rapid successive updates build on each other instead
  // of on a stale render's copy (which silently dropped earlier changes).
  const latestSettings = useRef(defaultSettings);
  latestSettings.current = settings;
  // Resolves once local settings are read. Cloud sync and updates wait for it
  // so defaults can never be written over the user's saved settings.
  const localLoaded = useRef(null);
  if (!localLoaded.current) {
    let resolve;
    localLoaded.current = { promise: new Promise(r => { resolve = r; }), resolve };
  }

  // Load from AsyncStorage first (instant, offline-safe)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        const parsed = await safeParse(SETTINGS_STORAGE_KEY, stored, null);
        const hasStored = !!(parsed && typeof parsed === 'object');
        if (hasStored) {
          latestSettings.current = { ...latestSettings.current, ...parsed };
        }
        // Existing installs keep the familiar board until they opt in.
        const launched = await AsyncStorage.getItem('hasLaunched').catch(() => null);
        const migration = migrateExperience(hasStored ? parsed : null, hasStored || launched === 'true');
        if (migration) {
          latestSettings.current = {
            ...latestSettings.current,
            ...migration,
            boardLayoutSource: migration.boardLayout === 'studio' ? 'new-install' : 'existing-install',
          };
          AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(latestSettings.current)).catch(() => {});
        }
        setSettings(latestSettings.current);
      } catch (e) {
        console.warn('Failed to load local settings:', e);
      }
      // Always finish loading after local read, even if it fails
      setLoading(false);
      localLoaded.current.resolve();
    })();
  }, []);

  // Subscribe to Firebase as secondary sync (non-blocking)
  // Re-subscribes when the user changes (login/logout)
  useEffect(() => {
    // Anonymous (guest) sessions stay local-only — no cloud settings sync.
    // Wait for local settings first: a cloud snapshot arriving earlier used to
    // be merged into defaults and saved over the user's local settings.
    const uid = user && !user.isAnonymous ? user.uid : null;
    if (!uid || !db || loading) return undefined;

    const settingsRef = ref(db, dbPath(DB_PATHS.USER_SETTINGS, uid));
    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const remote = snapshot.val();
          setSettings(prev => {
            const merged = mergeRemoteSettings(prev, remote);
            if (merged === prev) return prev;
            latestSettings.current = merged;
            // Persist the merged result locally
            AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
            return merged;
          });
        }
      },
      (error) => {
        // Firebase errors are non-fatal — local settings are already loaded
        console.warn('Firebase settings sync error (non-blocking):', error.message);
      }
    );

    return () => unsubscribe();
  }, [user, loading]);

  // Update settings: write to AsyncStorage immediately, sync to Firebase if possible
  const updateSettings = useCallback(async (updates) => {
    await localLoaded.current.promise;
    // Per-mode presentation keys are stored in the active mode's profile.
    const previous = latestSettings.current;
    const newSettings = routeSettingsUpdate(previous, updates);
    // An explicit board choice is final: cloud migration never overrides it.
    if (updates.boardLayout) newSettings.boardLayoutSource = 'chosen';
    const changed = {};
    Object.keys(newSettings).forEach((k) => {
      if (newSettings[k] !== previous[k]) changed[k] = newSettings[k];
    });
    latestSettings.current = newSettings;
    setSettings(newSettings);

    // Write locally first (always succeeds)
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings locally:', e);
    }

    // Try Firebase sync (non-blocking; guests stay local-only)
    try {
      const uid = user && !user.isAnonymous ? user.uid : null;
      if (uid && db) {
        const patch = cloudPatchFor(changed, previous);
        // A new install records its board on the account with its first
        // write, so later snapshots don't mistake it for a pre-Voice 2 account.
        if (Object.keys(patch).length > 0 && newSettings.boardLayoutSource === 'new-install' && newSettings.boardLayout) {
          patch.boardLayout = newSettings.boardLayout;
        }
        if (Object.keys(patch).length > 0) {
          await update(ref(db, dbPath(DB_PATHS.USER_SETTINGS, uid)), patch);
        }
      }
    } catch (e) {
      // Firebase sync failure is acceptable — local is source of truth
      console.warn('Firebase settings sync failed (will retry later):', e.message);
    }
  }, [user]);

  // Screens read the active mode's settings; storage keeps both modes.
  const effective = React.useMemo(() => effectiveSettings(settings), [settings]);

  return (
    <SettingsContext.Provider value={{ settings: effective, storedSettings: settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
