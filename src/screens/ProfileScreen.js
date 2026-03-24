// src/screens/ProfileScreen.js
// Shows user profile when logged in, or login prompt for guest users.
// Includes account deletion for Play Store compliance.

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { getAuth, signOut, deleteUser } from 'firebase/auth';
import { getDatabase, ref, remove } from 'firebase/database';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPalette, shadows, radii, spacing } from '../theme';
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
      Alert.alert('Error', 'Could not log out. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all synced data. Communication data on this device will not be affected.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = getAuth().currentUser;
              if (!currentUser) return;
              const uid = currentUser.uid;

              // Delete user data from database
              try {
                const db = getDatabase();
                await remove(ref(db, `users/${uid}`));
                await remove(ref(db, `userSettings/${uid}`));
              } catch (dbErr) {
                console.warn('Could not remove user data:', dbErr);
              }

              // Delete auth account
              await deleteUser(currentUser);
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } catch (error) {
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication Required',
                  'For security, please log out and log back in, then try deleting again.'
                );
              } else {
                Alert.alert('Error', 'Could not delete account. Please try again.');
              }
            }
          },
        },
      ]
    );
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
      <View style={[styles.profileCard, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={[styles.avatarText, { color: palette.buttonText }]}>{initials}</Text>
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
          <MaterialIcons name="settings" size={20} color={palette.buttonText} />
          <Text style={[styles.actionText, { color: palette.buttonText }]}>Settings</Text>
        </TouchableOpacity>

        {user ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.danger }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <MaterialIcons name="logout" size={20} color={palette.buttonText} />
            <Text style={[styles.actionText, { color: palette.buttonText }]}>Log Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.info }]}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to sync data"
          >
            <MaterialIcons name="login" size={20} color={palette.buttonText} />
            <Text style={[styles.actionText, { color: palette.buttonText }]}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      {user && (
        <TouchableOpacity
          style={styles.deleteLink}
          onPress={handleDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel="Delete your account permanently"
        >
          <Text style={[styles.deleteLinkText, { color: palette.danger }]}>Delete Account</Text>
        </TouchableOpacity>
      )}

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileCard: {
    width: '100%',
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  email: { fontSize: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  actionText: { marginLeft: spacing.sm, fontSize: 16, fontWeight: '500' },
  deleteLink: { marginTop: spacing.xxl, padding: spacing.sm },
  deleteLinkText: { fontSize: 14 },
});
