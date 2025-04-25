// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebaseConfig';
import { logEvent } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const auth = getAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Fetch user profile data from database
  const fetchUserProfile = useCallback(async (uid) => {
    try {
      // First check if user is a caregiver
      const caregiverRef = ref(db, `caregivers/${uid}`);
      const caregiverSnapshot = await get(caregiverRef);
      
      if (caregiverSnapshot.exists()) {
        const caregiverData = caregiverSnapshot.val();
        setUserProfile({
          ...caregiverData,
          type: 'caregiver',
          uid
        });
        return;
      }
      
      // If not a caregiver, check if user is an AAC user
      const userRef = ref(db, `users/${uid}`);
      const userSnapshot = await get(userRef);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        setUserProfile({
          ...userData,
          type: 'user',
          uid
        });
        return;
      }
      
      // If neither, set a basic profile with just UID
      setUserProfile({ uid, type: 'unknown' });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to fetch user profile data');
    }
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        
        try {
          // Get token claims to check admin status
          const tokenResult = await firebaseUser.getIdTokenResult();
          setClaims(tokenResult.claims);
          
          // Fetch the user profile
          await fetchUserProfile(firebaseUser.uid);
          
          // Store authentication state for offline usage
          await AsyncStorage.setItem('authUser', JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            claims: tokenResult.claims
          }));
          
        } catch (error) {
          console.error('Error processing authenticated user:', error);
          setError('Authentication verification failed');
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setClaims({});
        setUserProfile(null);
        
        // Clear stored auth data
        await AsyncStorage.removeItem('authUser');
      }
      
      setLoading(false);
      setAuthInitialized(true);
    });
    
    // Try to get cached auth data on init (for offline use)
    const loadCachedAuthData = async () => {
      try {
        const cachedAuthUser = await AsyncStorage.getItem('authUser');
        if (cachedAuthUser && !currentUser) {
          const authData = JSON.parse(cachedAuthUser);
          setClaims(authData.claims || {});
          // This is just for UI purposes while actually authenticating
          // Real authentication will happen via onAuthStateChanged
        }
      } catch (error) {
        console.log('No cached auth data found');
      }
    };
    
    loadCachedAuthData();
    
    return unsubscribe;
  }, [auth, fetchUserProfile]);

  // Helper function to determine if the user is an admin
  const isAdmin = claims.role === 'admin';
  
  // Helper function to determine if the user is a caregiver
  const isCaregiver = userProfile?.type === 'caregiver' || isAdmin;

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await logEvent('user_login', { email });
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Failed to log in';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Signup function
  const signup = async (email, password, name, userType = 'user') => {
    setLoading(true);
    setError(null);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Add user to the appropriate collection based on type
      const collection = userType === 'caregiver' ? 'caregivers' : 'users';
      await set(ref(db, `${collection}/${user.uid}`), {
        name: name || email.split('@')[0],
        email: email,
        createdAt: Date.now(),
        type: userType
      });
      
      await logEvent('user_signup', { email, userType });
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await logEvent('user_logout', { uid: currentUser?.uid });
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to log out');
      throw new Error('Failed to log out');
    } finally {
      setLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);
    
    try {
      await sendPasswordResetEmail(auth, email);
      await logEvent('password_reset_request', { email });
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user claims (useful after admin grants new permissions)
  const refreshUserClaims = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // Force token refresh
      await currentUser.getIdToken(true);
      const tokenResult = await currentUser.getIdTokenResult();
      setClaims(tokenResult.claims);
    } catch (error) {
      console.error('Error refreshing token claims:', error);
      setError('Failed to refresh user permissions');
    } finally {
      setLoading(false);
    }
  };

  // Value object with all auth related state and functions
  const value = {
    currentUser,
    userProfile,
    isAdmin,
    isCaregiver,
    claims,
    loading,
    error,
    authInitialized,
    login,
    signup,
    logout,
    resetPassword,
    refreshUserClaims
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};