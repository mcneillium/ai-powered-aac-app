// src/screens/LoginScreen.js
// Email/password login with password reset support.
// Navigates back to main app on success.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { logEvent } from '../utils/logger';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, brand, radii, spacing } from '../theme';
import logo from '../../assets/icon.png';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Try again or reset it below.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    default: return 'Login failed. Please check your details and try again.';
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      logEvent('User logged in', { email: trimmedEmail });
      // Auth state change triggers context update — navigate back to app
      navigation.goBack();
    } catch (error) {
      logEvent('Login error', { email: trimmedEmail, error: error.code });
      Alert.alert('Login Failed', friendlyAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Enter Email', 'Type your email address above, then tap Reset Password.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(
        'Reset Email Sent',
        `If an account exists for ${trimmedEmail}, a password reset link has been sent. Check your inbox.`
      );
    } catch (error) {
      // Don't reveal if email exists or not for security
      Alert.alert(
        'Reset Email Sent',
        'If an account exists for this email, a password reset link has been sent.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel={`${brand.name} logo`} />
      <Text style={[styles.title, { color: palette.text }]}>Log In</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{brand.tagline}</Text>

      <TextInput
        style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
        placeholder="Email"
        placeholderTextColor={palette.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email input"
        returnKeyType="next"
      />

      <TextInput
        style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
        placeholder="Password"
        placeholderTextColor={palette.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password input"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      {loading ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={handleLogin}
          accessibilityRole="button"
          accessibilityLabel="Log in"
        >
          <Text style={[styles.buttonText, { color: palette.buttonText }]}>Log In</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handlePasswordReset}
        style={styles.link}
        accessibilityRole="button"
        accessibilityLabel="Reset your password"
      >
        <Text style={[styles.linkText, { color: palette.textSecondary }]}>
          Forgot password?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Signup')}
        style={styles.link}
        accessibilityRole="link"
        accessibilityLabel="Navigate to sign up"
      >
        <Text style={[styles.linkText, { color: palette.primary }]}>
          Don't have an account? Sign Up
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  logo: { width: 100, height: 100, alignSelf: 'center', marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: spacing.xxl },
  input: { height: 50, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, marginBottom: spacing.lg, fontSize: 16 },
  loader: { marginVertical: spacing.xl },
  button: { paddingVertical: 14, borderRadius: radii.md, alignItems: 'center', marginBottom: spacing.md },
  buttonText: { fontSize: 18, fontWeight: '600' },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { fontSize: 15 },
});
