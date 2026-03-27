// src/contexts/AuthContext.js
// Provides Firebase auth state and user role (user/caregiver) to the app.
// Role is read from Realtime Database at /users/{uid}/role on auth change.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { auth } from '../../firebaseConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'user' | 'caregiver' | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        if (u) {
          // Fetch role from database (non-blocking on failure)
          try {
            const db = getDatabase();
            const snap = await get(ref(db, `users/${u.uid}/role`));
            setRole(snap.exists() ? snap.val() : 'user');
          } catch {
            setRole('user'); // default if DB unreachable
          }
        } else {
          setRole(null);
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
