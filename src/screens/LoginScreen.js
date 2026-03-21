// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { logEvent } from '../utils/logger';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, brand } from '../theme';
import logo from '../../assets/icon.png';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      logEvent('User logged in', { email });
    } catch (error) {
      logEvent('Login error', { email, error: error.message });
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
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
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  input: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, fontSize: 16 },
  loader: { marginVertical: 20 },
  button: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  link: { marginTop: 12, alignItems: 'center' },
  linkText: { fontSize: 16, textDecorationLine: 'underline' },
});
