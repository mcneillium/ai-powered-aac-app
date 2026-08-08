// src/screens/ProfileScreen.js
// Shows user profile when logged in, or login prompt for guest users.
// Includes account deletion for Play Store compliance.

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  // Anonymous Firebase sessions exist only so cloud AI calls carry a token —
  // in the UI they are guests.
  const account = user && !user.isAnonymous ? user : null;

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
      // The old copy promised "Communication data on this device will not be
      // affected" while the handler cleared the AI profile, sentence history,
      // favourites and custom vocabulary. The user consented to one thing and a
      // materially different, irreversible thing happened — for an AAC user
      // that is years of accumulated personalisation, not a cache.
      'This permanently deletes your account and everything in it, on this device and in the cloud:\n\n' +
        '• your personal vocabulary and any words you added\n' +
        '• your saved sentences and favourites\n' +
        '• what the app has learned about how you communicate\n' +
        '• your settings, activity history and any feedback you sent\n\n' +
        'Nothing can be recovered afterwards. If you only want to sign out, use Log Out instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = getAuth().currentUser;
              if (!currentUser) return;
              const uid = currentUser.uid;

              // Check the credential is fresh enough BEFORE destroying anything.
              //
              // Firebase requires a recent sign-in for deleteUser and throws
              // auth/requires-recent-login otherwise. For a real user that is
              // the normal case, not an edge case — an AAC device stays signed
              // in for weeks. Previously the data was deleted first and the
              // throw landed last, so the most likely outcome of tapping delete
              // was: every node gone, all local vocabulary and favourites
              // cleared, the account still there, and a message inviting a
              // retry. The user would sign back in to an empty app having never
              // actually deleted anything.
              //
              // Nothing irreversible runs until deleteUser is known to be able
              // to succeed.
              const lastSignIn = Date.parse(currentUser.metadata?.lastSignInTime ?? '');
              const RECENT_LOGIN_WINDOW_MS = 4 * 60_000; // Firebase allows ~5; leave headroom.
              if (!Number.isFinite(lastSignIn) || Date.now() - lastSignIn > RECENT_LOGIN_WINDOW_MS) {
                Alert.alert(
                  'Please sign in again first',
                  'For your security, deleting an account needs a recent sign-in.\n\n' +
                    'Log out, log back in, and then delete. Nothing has been changed.'
                );
                return;
              }

              // Delete all user data from Firebase.
              //
              // allSettled, not all: one rejected delete used to abandon every
              // other one. And the outcome is checked, because the previous
              // version swallowed the failure and carried on to deleteUser —
              // after which every surviving node is protected by
              // `auth.uid === $uid` for a uid that can never authenticate
              // again. Unreachable, undeletable, permanent. That is a UK GDPR
              // Art. 17 failure with no recovery path, so it must now stop the
              // deletion rather than complete it dishonestly.
              const db = getDatabase();
              const paths = [
                `users/${uid}`,
                `userSettings/${uid}`,
                `userLogs/${uid}`,
                `userSync/${uid}`,
                `customVocab/${uid}`,
                `vocabRequests/${uid}`,
                // Previously missed. Holds the user's name, email and up to
                // 5000 characters of free text.
                `feedback/${uid}`,
              ];
              const results = await Promise.allSettled(
                paths.map((path) => remove(ref(db, path)))
              );
              const failedPaths = paths.filter((_, i) => results[i].status === 'rejected');

              if (failedPaths.length > 0) {
                console.warn('Account deletion aborted; these paths did not delete:', failedPaths);
                Alert.alert(
                  'Deletion incomplete',
                  `${paths.length - failedPaths.length} of ${paths.length} parts of your data were ` +
                    'removed, but the rest could not be, so your account itself has been left in ' +
                    'place — deleting it now would strand that data where nobody can reach it.\n\n' +
                    'What was already removed is gone and cannot be restored. Check your connection ' +
                    'and try again to finish, or contact support.'
                );
                return;
              }

              // Clear all user-related local data.
              // Tracked, because the success message used to claim everything
              // was deleted regardless of what actually happened here.
              let localCleared = false;
              try {
                await AsyncStorage.multiRemove([
                  '@aac_settings',
                  '@aac_ai_profile',
                  '@aac_sentence_history',
                  '@aac_favourites',
                  '@aac_custom_vocab',
                  '@aac_custom_vocab_deleted',
                  '@aac_vocab_requests',
                  '@aac_feedback_queue',
                  'userInteractionLog',
                  'wordPredictionModel',
                  'wordFrequencyModel',
                  'currentSessionId',
                  'lastActivity',
                  'logLevel',
                  'savedEmotion',
                ]);
                localCleared = true;
              } catch (localErr) {
                console.warn('Could not clear some local data:', localErr);
              }

              // Delete auth account
              await deleteUser(currentUser);
              Alert.alert(
                'Account Deleted',
                localCleared
                  ? 'Your account and all associated data have been permanently deleted.'
                  : 'Your account and cloud data have been deleted. Some data stored on this device ' +
                    'could not be cleared — uninstalling the app will remove it.'
              );
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

  const initials = account?.email ? account.email[0].toUpperCase() : '?';

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.profileCard, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={[styles.avatarText, { color: palette.buttonText }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: palette.text }]}>
          {account ? 'Welcome!' : 'Guest Mode'}
        </Text>
        <Text style={[styles.email, { color: palette.textSecondary }]}>
          {account?.email || 'Sign in to sync your settings and data'}
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

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: palette.accent }]}
          onPress={() => navigation.navigate('Insights')}
          accessibilityRole="button"
          accessibilityLabel="View communication insights"
        >
          <MaterialIcons name="insights" size={20} color={palette.buttonText} />
          <Text style={[styles.actionText, { color: palette.buttonText }]}>Insights</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.actions, { marginTop: spacing.sm }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: palette.info }]}
          onPress={() => navigation.navigate('VocabManager')}
          accessibilityRole="button"
          accessibilityLabel="Manage custom vocabulary"
        >
          <MaterialIcons name="library-add" size={20} color={palette.buttonText} />
          <Text style={[styles.actionText, { color: palette.buttonText }]}>Vocabulary</Text>
        </TouchableOpacity>

        {account ? (
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

      {account && (
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
