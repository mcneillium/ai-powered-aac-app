// src/contexts/AuthContext.js
// Provides Firebase auth state and user role (user/caregiver) to the app.
// Role is read from Realtime Database at /users/{uid}/role on auth change.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../../firebaseConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'user' | 'caregiver' | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Firebase not configured: everyone is a local guest; nothing to wait for.
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        if (u) {
          if (u.isAnonymous) {
            setRole(null);
          } else {
            // Fetch role from database (non-blocking on failure)
            try {
              const snap = await get(ref(db, `users/${u.uid}/role`));
              setRole(snap.exists() ? snap.val() : 'user');
            } catch {
              setRole('user'); // default if DB unreachable
            }
          }
        } else {
          setRole(null);
          // Guests get an anonymous Firebase session so the AI Cloud Function
          // endpoints (which require an ID token) still work without an
          // account. Fails quietly offline or if the provider is disabled —
          // the app remains fully usable, only cloud AI features are gated.
          signInAnonymously(auth).catch(() => {});
        }
        setLoading(false);
      },
      (e) => { setError(e); setLoading(false); }
    );
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
