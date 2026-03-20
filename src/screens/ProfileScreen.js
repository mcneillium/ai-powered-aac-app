// src/screens/ProfileScreen.js
// Shows user profile when logged in, or login prompt for guest users.
// Login is optional — communication works without it.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPalette } from '../theme';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const navigation = useNavigation();
  const palette = getPalette(settings.theme);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
    } catch (e) {
      console.warn('Logout error:', e);
    }
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Network status banner */}
      {!isOnline && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <MaterialIcons name="cloud-off" size={16} color="#FFF" />
          <Text style={styles.offlineText}>Offline — your data is saved locally</Text>
        </View>
      )}

      <View style={[styles.profileCard, { backgroundColor: palette.surface }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: palette.text }]}>
          {user ? 'Welcome!' : 'Guest Mode'}
        </Text>
        <Text style={[styles.email, { color: palette.textSecondary }]}>
          {user?.email || 'Sign in to sync your settings and data'}
        </Text>

        {/* Sync status */}
        {user && (
          <View style={[styles.syncBadge, { backgroundColor: isOnline ? '#E8F5E9' : '#FFF3E0' }]}>
            <MaterialIcons
              name={isOnline ? 'cloud-done' : 'cloud-off'}
              size={14}
              color={isOnline ? '#4CAF50' : '#FF9800'}
            />
            <Text style={[styles.syncText, { color: isOnline ? '#4CAF50' : '#FF9800' }]}>
              {isOnline ? 'Synced' : 'Offline'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: palette.primary }]}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <MaterialIcons name="settings" size={20} color="#fff" />
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={() => navigation.navigate('Feedback')}
          accessibilityRole="button"
          accessibilityLabel="Send feedback"
        >
          <MaterialIcons name="feedback" size={20} color="#fff" />
          <Text style={styles.actionText}>Feedback</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.authActions}>
        {user ? (
          <TouchableOpacity
            style={[styles.fullWidthButton, { backgroundColor: palette.danger }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <MaterialIcons name="logout" size={20} color="#fff" />
            <Text style={styles.actionText}>Log Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.fullWidthButton, { backgroundColor: palette.info }]}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to sync data"
          >
            <MaterialIcons name="login" size={20} color="#fff" />
            <Text style={styles.actionText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    gap: 6,
  },
  offlineText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  profileCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 8,
  },
  authActions: {
    width: '100%',
  },
  fullWidthButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});
