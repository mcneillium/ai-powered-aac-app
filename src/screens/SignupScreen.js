// src/screens/SignupScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const auth = getAuth();

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation', 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const db = getDatabase();
      await set(ref(db, `users/${user.uid}`), {
        name: name.trim() || email.split('@')[0],
        email,
        role,
        createdAt: Date.now(),
      });
    } catch (error) {
      Alert.alert('Sign Up Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>Sign Up</Text>
      <TextInput
        style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
        placeholder="Your Name"
        placeholderTextColor={palette.textSecondary}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        onChangeText={setName}
        value={name}
        accessibilityLabel="Name input"
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
          <Text style={[styles.roleText, { color: role === 'user' ? '#FFF' : palette.text }]}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('caregiver')}
          style={[styles.roleBtn, { borderColor: palette.border, backgroundColor: role === 'caregiver' ? palette.primary : palette.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Select Caregiver Role"
          accessibilityState={{ selected: role === 'caregiver' }}
        >
          <Text style={[styles.roleText, { color: role === 'caregiver' ? '#FFF' : palette.text }]}>Caregiver</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={palette.primary} />
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={handleSignUp}
          accessibilityRole="button"
          accessibilityLabel="Register"
        >
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        accessibilityRole="link"
        accessibilityLabel="Navigate to Login"
      >
        <Text style={[styles.link, { color: palette.primary }]}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 14, marginBottom: 8, alignSelf: 'flex-start', marginLeft: '5%' },
  input: { width: '100%', height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, fontSize: 16 },
  roleToggle: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginBottom: 20, gap: 12 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  roleText: { fontSize: 16, fontWeight: '500' },
  button: { paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, marginBottom: 15, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  link: { fontSize: 16, marginTop: 8 },
});
