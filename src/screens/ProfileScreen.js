// src/screens/ProfileScreen.js
// "Me": the personalisation hub. Shows who Voice is set up for, what is
// switched on (learning, pictures, situation), and the ways to make it
// yours, plus the account (sign in / out, delete for Play Store compliance).

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarSpace } from '../components/tabBarMetrics';
import { getContextPack } from '../data/contextPacks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth as cloudAuth, db as cloudDb } from '../../firebaseConfig';
import CloudUnavailableNotice from '../components/CloudUnavailableNotice';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPalette, getExperience, symbolsOn, fonts, radii, spacing } from '../theme';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const navigation = useNavigation();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const insets = useSafeAreaInsets();
  // Anonymous Firebase sessions exist only so cloud AI calls carry a token —
  // in the UI they are guests.
  const account = user && !user.isAnonymous ? user : null;

  const handleLogout = async () => {
    try {
      if (cloudAuth) await signOut(cloudAuth);
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
              const currentUser = cloudAuth?.currentUser;
              if (!currentUser) return;
              const uid = currentUser.uid;

              // Delete all user data from Firebase
              try {
                const db = cloudDb;
                await Promise.all([
                  remove(ref(db, `users/${uid}`)),
                  remove(ref(db, `userSettings/${uid}`)),
                  remove(ref(db, `userLogs/${uid}`)),
                  remove(ref(db, `userSync/${uid}`)),
                  remove(ref(db, `customVocab/${uid}`)),
                  remove(ref(db, `vocabRequests/${uid}`)),
                ]);
              } catch (dbErr) {
                console.warn('Could not remove some user data:', dbErr);
              }

              // Clear all user-related local data
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
              } catch (localErr) {
                console.warn('Could not clear some local data:', localErr);
              }

              // Delete auth account
              await deleteUser(currentUser);
              Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.');
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

  const situation = settings.activeSituation ? getContextPack(settings.activeSituation) : null;
  const learningOn = settings.localLearning === true;
  const status = [
    { key: 'learn', icon: learningOn ? 'sparkles' : 'sparkles-outline', text: learningOn ? 'Learning on' : 'Learning off' },
    { key: 'pics', icon: 'image-outline', text: symbolsOn(settings) ? 'Pictures on' : 'Pictures off' },
    { key: 'sit', icon: situation ? situation.icon : 'compass-outline', text: situation ? situation.label : 'No situation' },
  ];
  const tiles = [
    { key: 'settings', icon: 'color-palette-outline', title: 'Make Voice yours', sub: 'Mode, look, voice, board', to: 'Settings', a11y: 'Open settings' },
    { key: 'learning', icon: 'sparkles-outline', title: 'What Voice learned', sub: learningOn ? 'On · see, edit, clear' : 'Off · turn on here', to: 'Learning', a11y: 'See what Voice has learned' },
    { key: 'vocab', icon: 'add-circle-outline', title: 'My words', sub: 'Add your own words', to: 'VocabManager', a11y: 'Manage custom vocabulary' },
    { key: 'insights', icon: 'stats-chart-outline', title: 'Insights', sub: 'Words used, gaps', to: 'Insights', a11y: 'View communication insights' },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.container, { paddingBottom: tabBarSpace(insets.bottom) + spacing.lg }]}
    >
      <View style={[styles.hero, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.tileRadius + 6 }]}>
        <View style={[styles.avatar, { backgroundColor: palette.primaryMuted }]}>
          <Text style={styles.avatarEmoji} importantForAccessibility="no">{experience.id === 'child' ? '🧒' : '🧑'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: palette.text, fontFamily: experience.headlineFont }]}>
            {account ? 'Welcome back' : 'Guest'}
          </Text>
          <Text style={[styles.email, { color: palette.textSecondary }]} numberOfLines={1}>
            {account?.email || `${experience.label} experience · on this device`}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        {status.map(st => (
          <View key={st.key} style={[styles.status, { backgroundColor: palette.surface }]} accessible accessibilityLabel={st.text}>
            <Ionicons name={st.icon} size={16} color={palette.text} />
            <Text style={[styles.statusText, { color: palette.text }]} numberOfLines={1}>{st.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {tiles.map(tl => (
          <TouchableOpacity
            key={tl.key}
            style={[styles.tile, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.tileRadius }]}
            onPress={() => navigation.navigate(tl.to)}
            accessibilityRole="button"
            accessibilityLabel={tl.a11y}
            accessibilityHint={tl.sub}
          >
            <View style={[styles.tileIcon, { backgroundColor: palette.primaryMuted }]}>
              <Ionicons name={tl.icon} size={24} color={palette.onPrimaryMuted} />
            </View>
            <Text style={[styles.tileTitle, { color: palette.text }]}>{tl.title}</Text>
            <Text style={[styles.tileSub, { color: palette.textSecondary }]}>{tl.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <CloudUnavailableNotice />

      {account ? (
        <TouchableOpacity
          style={[styles.accountBtn, { backgroundColor: palette.surface }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <MaterialIcons name="logout" size={20} color={palette.text} />
          <Text style={[styles.accountText, { color: palette.text }]}>Log out</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.accountBtn, { backgroundColor: palette.surface }]}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in to sync data"
        >
          <MaterialIcons name="login" size={20} color={palette.text} />
          <Text style={[styles.accountText, { color: palette.text }]}>Sign in to sync (optional)</Text>
        </TouchableOpacity>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderWidth: 1 },
  avatar: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 40 },
  name: { fontSize: 26 },
  email: { fontSize: 15, fontFamily: fonts.regular, marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: radii.pill },
  statusText: { fontSize: 14, fontFamily: fonts.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47.5%', minHeight: 140, padding: spacing.md, borderWidth: 1, gap: 4 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  tileTitle: { fontSize: 17, fontFamily: fonts.bold },
  tileSub: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 19 },
  accountBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: radii.lg },
  accountText: { fontSize: 16, fontFamily: fonts.bold },
  deleteLink: { alignSelf: 'center', padding: spacing.sm, minHeight: 44, justifyContent: 'center' },
  deleteLinkText: { fontSize: 15, fontFamily: fonts.regular },
});
