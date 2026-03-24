// src/screens/SignupScreen.js
// User registration with name, email, password, and role.
// Navigates back on success. Stores user profile in Firebase.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password is too weak. Use at least 6 characters.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    default: return 'Registration failed. Please try again.';
  }
}

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      // Write user profile to database
      try {
        const db = getDatabase();
        await set(ref(db, `users/${user.uid}`), {
          name: trimmedName || trimmedEmail.split('@')[0],
          email: trimmedEmail,
          role,
          createdAt: Date.now(),
        });
      } catch (dbError) {
        // Auth succeeded but DB write failed — user can still use the app
        console.warn('Profile DB write failed:', dbError);
      }

      // Auth state change triggers context — navigate back
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Registration Failed', friendlyAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: palette.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Sign up to sync your settings across devices
        </Text>

        <TextInput
          style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
          placeholder="Your Name (optional)"
          placeholderTextColor={palette.textSecondary}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          onChangeText={setName}
          value={name}
          accessibilityLabel="Name input"
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
          placeholder="Email"
          placeholderTextColor={palette.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          onChangeText={setEmail}
          value={email}
          keyboardType="email-address"
          accessibilityLabel="Email input"
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={palette.textSecondary}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={setPassword}
          value={password}
          accessibilityLabel="Password input"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />

        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>I am a:</Text>
        <View style={styles.roleToggle}>
          <TouchableOpacity
            onPress={() => setRole('user')}
            style={[styles.roleBtn, { borderColor: palette.border, backgroundColor: role === 'user' ? palette.primary : palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Select User Role"
            accessibilityState={{ selected: role === 'user' }}
          >
            <Text style={[styles.roleText, { color: role === 'user' ? palette.buttonText : palette.text }]}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole('caregiver')}
            style={[styles.roleBtn, { borderColor: palette.border, backgroundColor: role === 'caregiver' ? palette.primary : palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Select Caregiver Role"
            accessibilityState={{ selected: role === 'caregiver' }}
          >
            <Text style={[styles.roleText, { color: role === 'caregiver' ? palette.buttonText : palette.text }]}>Caregiver</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={palette.primary} style={{ marginVertical: spacing.xl }} />
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.primary }]}
            onPress={handleSignUp}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text style={[styles.buttonText, { color: palette.buttonText }]}>Create Account</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel="Navigate to Login"
        >
          <Text style={[styles.linkText, { color: palette.primary }]}>Already have an account? Log In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: spacing.xxl },
  sectionLabel: { fontSize: 14, marginBottom: spacing.sm },
  input: { width: '100%', height: 50, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, marginBottom: spacing.lg, fontSize: 16 },
  roleToggle: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginBottom: spacing.xl, gap: spacing.md },
  roleBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center' },
  roleText: { fontSize: 16, fontWeight: '500' },
  button: { paddingVertical: 14, borderRadius: radii.md, width: '100%', alignItems: 'center', marginBottom: spacing.lg },
  buttonText: { fontSize: 18, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { fontSize: 15 },
});
