import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { logEvent } from '../utils/logger';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const auth = getAuth();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      logEvent('User logged in', { email });
      navigation.navigate('MainApp');
    } catch (error) {
      logEvent('Login error', { email, error: error.message });
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : (
        <Button title="Log In" onPress={handleLogin} />
      )}
      <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.signUpButton}>
        <Text style={styles.signUpText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15
  },
  loader: {
    marginVertical: 20
  },
  signUpButton: {
    marginTop: 20,
    alignItems: 'center'
  },
  signUpText: {
    color: '#4CAF50',
    fontSize: 16,
    textDecorationLine: 'underline'
  }
});
