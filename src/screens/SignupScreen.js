// src/screens/SignupScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../../firebaseConfig';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await set(ref(db, `users/${user.uid}`), {
        name: name.trim() || email.split('@')[0],
        email,
        role,
        createdAt: Date.now(),
      });
      // Dismiss the login/signup modal — AuthContext will reflect the new state
      if (navigation.getParent()?.canGoBack()) {
        navigation.getParent().goBack();
      }
    } catch (error) {
      alert('Sign up error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Your Name"
        autoCapitalize="words"
        onChangeText={setName}
        value={name}
        accessibilityLabel="Name input"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      <View style={styles.roleToggle}>
        <TouchableOpacity onPress={() => setRole('user')} accessibilityRole="button" accessibilityLabel="Select User Role">
          <Text style={[styles.roleText, role === 'user' && styles.selectedRole]}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole('caregiver')} accessibilityRole="button" accessibilityLabel="Select Caregiver Role">
          <Text style={[styles.roleText, role === 'caregiver' && styles.selectedRole]}>Caregiver</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSignUp} accessibilityRole="button" accessibilityLabel="Register Button">
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="link" accessibilityLabel="Navigate to Login">
        <Text style={styles.link}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16
  },
  roleToggle: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15
  },
  roleText: {
    fontSize: 16,
    color: '#000'
  },
  selectedRole: {
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  link: {
    color: '#4CAF50',
    fontSize: 16
  }
});
// This code defines a SignupScreen component for a React Native application that allows users to sign up with an email and password.
// It uses Firebase Authentication to create a new user and stores user details in Firebase Realtime Database