// src/screens/ProfileScreen.js
// Shows user profile when logged in, or login prompt for guest users.
// Login is optional — communication works without it.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
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

        {user ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.danger }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <MaterialIcons name="logout" size={20} color="#fff" />
            <Text style={styles.actionText}>Log Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.info }]}
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
  profileCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
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
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});
