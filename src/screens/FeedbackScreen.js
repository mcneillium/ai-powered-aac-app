// src/screens/FeedbackScreen.js
// User feedback submission form. Writes to Firebase under feedback/{uid}.
// Requires authentication — guest users are prompted to sign in.

import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ref, push } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { DB_PATHS, dbPath } from '../shared/schema';

export default function FeedbackScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const palette = getPalette(settings.theme);

  const [feedback, setFeedback] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      return Alert.alert('Validation', 'Feedback cannot be empty.');
    }
    if (!user?.uid) {
      return Alert.alert(
        'Sign in required',
        'Please sign in to submit feedback. Your communication works without an account, but feedback needs one.'
      );
    }

    setSubmitting(true);
    try {
      await push(ref(db, dbPath(DB_PATHS.FEEDBACK, user.uid)), {
        name: name.trim() || user.email?.split('@')[0] || '',
        email: email.trim() || user.email || '',
        role,
        feedback: feedback.trim(),
        timestamp: Date.now(),
      });
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
      setFeedback('');
    } catch (e) {
      console.warn('Feedback submission error:', e);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      nestedScrollEnabled
    >
      <Text style={[styles.title, { color: palette.text }]}>We value your feedback</Text>

      <TextInput
        style={[styles.input, { color: palette.text, backgroundColor: palette.surface }]}
        placeholder="Your Name"
        placeholderTextColor={palette.textSecondary}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Your name"
      />
      <TextInput
        style={[styles.input, { color: palette.text, backgroundColor: palette.surface }]}
        placeholder="Your Email"
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor={palette.textSecondary}
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Your email"
      />
      <TextInput
        style={[styles.input, { color: palette.text, backgroundColor: palette.surface }]}
        placeholder="Your Role"
        placeholderTextColor={palette.textSecondary}
        value={role}
        onChangeText={setRole}
        accessibilityLabel="Your role"
      />
      <TextInput
        style={[styles.input, styles.multiline, { color: palette.text, backgroundColor: palette.surface }]}
        multiline
        numberOfLines={5}
        placeholder="Your Feedback"
        placeholderTextColor={palette.textSecondary}
        value={feedback}
        onChangeText={setFeedback}
        accessibilityLabel="Your feedback"
      />

      {submitting ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: palette.primary }]}
          onPress={submitFeedback}
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
        >
          <Text style={styles.submitText}>Submit</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  multiline: { height: 120, textAlignVertical: 'top' },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loader: { marginVertical: 20 },
});
