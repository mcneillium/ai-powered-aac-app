import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { getDatabase, ref, push } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../styles/theme';

export default function FeedbackScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [feedback, setFeedback] = useState('');
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState('user');
  const [submitting, setSubmitting] = useState(false);

  const palette = getPalette(settings.theme);

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>  
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const MAX_FEEDBACK_LENGTH = 2000;

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      return Alert.alert('Validation', 'Feedback cannot be empty');
    }
    if (feedback.length > MAX_FEEDBACK_LENGTH) {
      return Alert.alert('Validation', `Feedback must be under ${MAX_FEEDBACK_LENGTH} characters`);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Alert.alert('Validation', 'Please enter a valid email address');
    }
    setSubmitting(true);
    try {
      const uid = getAuth().currentUser?.uid || 'anonymous';
      await push(ref(getDatabase(), `feedback/${uid}`), {
        name,
        email,
        role,
        feedback,
        timestamp: Date.now(),
      });
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
      setFeedback('');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      nestedScrollEnabled={true}
    >
      <Text style={[styles.title, { color: palette.text }]}>We value your feedback</Text>
      <TextInput
        style={[styles.input, { color: palette.text }]}
        placeholder="Your Name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, { color: palette.text }]}
        placeholder="Your Email"
        keyboardType="email-address"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: palette.text }]}
        placeholder="Role"
        placeholderTextColor="#888"
        value={role}
        onChangeText={setRole}
      />
      <TextInput
        style={[styles.input, { height: 120, color: palette.text }]}
        multiline
        numberOfLines={5}
        placeholder="Your Feedback"
        placeholderTextColor="#888"
        value={feedback}
        onChangeText={setFeedback}
      />

      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Submit" onPress={submitFeedback} color="#4CAF50" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input:     {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
});
