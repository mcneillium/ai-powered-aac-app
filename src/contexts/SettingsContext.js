// src/contexts/SettingsContext.js
// Offline-first settings: AsyncStorage is the primary store.
// Firebase syncs when available but never blocks the UI.

import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { useAuth } from './AuthContext';
import { DB_PATHS, dbPath } from '../shared/schema';

const SETTINGS_STORAGE_KEY = '@aac_settings';

const defaultSettings = {
  theme: 'light',
  gridSize: 3,
  contrast: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVoice: null,
  aiPersonalisationEnabled: true,
  scanMode: 'auto',
  scanSpeed: 1500,
  crisisModeEnabled: true,
  listenerModeEnabled: false,
  partnerCoachEnabled: true,
  showSymbols: true,
  preferredSymbolSource: 'auto',
  communicationLanguage: 'en',
};

export const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
  updateSettings: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load from AsyncStorage first (instant, offline-safe)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        // Failed to load local settings — non-fatal
      }
      // Always finish loading after local read, even if it fails
      setLoading(false);
    })();
  }, []);

  // Subscribe to Firebase as secondary sync (non-blocking)
  // Re-subscribes when the user changes (login/logout)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const settingsRef = ref(db, dbPath(DB_PATHS.USER_SETTINGS, uid));
    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const remote = snapshot.val();
          setSettings(prev => {
            const merged = { ...prev, ...remote };
            // Persist the merged result locally
            AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
            return merged;
          });
        }
      },
      (_error) => {
        // Firebase errors are non-fatal — local settings are already loaded
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Update settings: write to AsyncStorage immediately, sync to Firebase if possible
  const updateSettings = useCallback(async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    // Write locally first (always succeeds)
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      // Failed to save settings locally — non-fatal
    }

    // Try Firebase sync (non-blocking)
    try {
      const uid = user?.uid;
      if (uid) {
        await set(ref(db, dbPath(DB_PATHS.USER_SETTINGS, uid)), newSettings);
      }
    } catch (e) {
      // Firebase sync failure is acceptable — local is source of truth
      // Firebase settings sync failed — will retry on next change
    }
  }, [settings, user]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
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
