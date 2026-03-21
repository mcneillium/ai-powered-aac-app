import React, { useState } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { getDatabase, ref, push } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { getPalette } from '../theme';

const FEEDBACK_QUEUE_KEY = '@aac_feedback_queue';

export default function FeedbackScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const { isOnline } = useNetwork();
  const [feedback, setFeedback] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const palette = getPalette(settings.theme);

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      return Alert.alert('Validation', 'Feedback cannot be empty');
    }
    setSubmitting(true);
    const entry = {
      name,
      email,
      role,
      feedback,
      timestamp: Date.now(),
    };

    try {
      if (isOnline) {
        const uid = getAuth().currentUser?.uid || 'anonymous';
        await push(ref(getDatabase(), `feedback/${uid}`), entry);
        Alert.alert('Thank you!', 'Your feedback has been submitted.');
      } else {
        // Queue for later sync
        const stored = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
        const queue = stored ? JSON.parse(stored) : [];
        queue.push(entry);
        await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queue));
        Alert.alert('Saved Locally', 'Your feedback will be sent when you reconnect.');
      }
      setFeedback('');
    } catch (e) {
      // Fallback to local queue on any error
      try {
        const stored = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
        const queue = stored ? JSON.parse(stored) : [];
        queue.push(entry);
        await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queue));
        Alert.alert('Saved Locally', 'Your feedback will be sent when you reconnect.');
        setFeedback('');
      } catch {
        Alert.alert('Error', 'Failed to submit feedback.');
      }
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

      {!isOnline && (
        <View style={[styles.offlineNote, { backgroundColor: palette.warning + '20', borderColor: palette.warning }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={palette.warning} />
          <Text style={[styles.offlineText, { color: palette.text }]}>
            Offline — feedback will be saved and sent later
          </Text>
        </View>
      )}

      <TextInput
        style={[styles.input, { color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
        placeholder="Your Name"
        placeholderTextColor={palette.textSecondary}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Your name"
        autoComplete="name"
      />
      <TextInput
        style={[styles.input, { color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
        placeholder="Your Email"
        keyboardType="email-address"
        placeholderTextColor={palette.textSecondary}
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Your email"
        autoComplete="email"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
        placeholder="Role (user or caregiver)"
        placeholderTextColor={palette.textSecondary}
        value={role}
        onChangeText={setRole}
        accessibilityLabel="Your role"
      />
      <TextInput
        style={[styles.input, { height: 120, color: palette.text, borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}
        multiline
        numberOfLines={5}
        placeholder="Your Feedback"
        placeholderTextColor={palette.textSecondary}
        value={feedback}
        onChangeText={setFeedback}
        accessibilityLabel="Your feedback"
        textAlignVertical="top"
      />

      {submitting ? (
        <ActivityIndicator size="large" color={palette.primary} />
      ) : (
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: palette.primary }]}
          onPress={submitFeedback}
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
        >
          <Ionicons name="send-outline" size={20} color="#FFF" />
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
  offlineNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12,
  },
  offlineText: { fontSize: 13, flex: 1 },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 8, gap: 8, marginTop: 8,
  },
  submitText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
