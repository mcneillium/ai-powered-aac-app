// src/contexts/AuthContext.js
// Provides Firebase auth state and user role (user/caregiver) to the app.
// Role is read from Realtime Database at /users/{uid}/role on auth change.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../../firebaseConfig';
import { resumeAccountDataSync } from '../services/accountDeletionBarrier';

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
    let previousUid;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (u) => {
        // The initial observation must not invalidate concurrent local settings
        // loads. Only an actual session transition resumes a paused deletion.
        if (previousUid !== undefined && previousUid !== (u?.uid || null)) resumeAccountDataSync();
        previousUid = u?.uid || null;
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
          // A local guest needs no Firebase identity. Explicit cloud feature
          // requests obtain their guest token at the point of use instead.
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
