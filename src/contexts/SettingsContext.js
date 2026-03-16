// src/contexts/SettingsContext.js
import React, { createContext, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue } from 'firebase/database';

// Define default settings
const defaultSettings = {
  theme: 'light',        // 'light' | 'dark' | 'highContrast'
  gridSize: 3,           // Number of pictogram columns
  contrast: false,       // High contrast toggle
};

// Create context
export const SettingsContext = createContext({
  settings: defaultSettings,
  loading: true,
});

// Provider component
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const db = getDatabase();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const settingsRef = ref(db, `userSettings/${uid}`);
    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setSettings({
            theme: data.theme || defaultSettings.theme,
            gridSize: data.gridSize || defaultSettings.gridSize,
            contrast: data.contrast ?? defaultSettings.contrast,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading settings:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook for convenience
export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
