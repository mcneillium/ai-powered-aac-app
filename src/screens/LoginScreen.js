// src/screens/LoginScreen.js
import React, { useState }                             from 'react';
import {
  View, Text, TextInput, Button,
  StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, Image
}                                                      from 'react-native';
import { signInWithEmailAndPassword }                  from 'firebase/auth';
import { auth }                                        from '../../firebaseConfig';
import { logEvent }                                    from '../utils/logger';
import { useNavigation }                               from '@react-navigation/native';
import logo                                           from '../../assets/icon.png';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigation             = useNavigation();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Logged in as', cred.user.uid);
      logEvent('User logged in', { email });
      // navigation is driven by AuthContext in App.js
    } catch (error) {
      console.error('❌ Login error', error);
      logEvent('Login error', { email, error: error.message });
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image  source={logo}  style={styles.logo} resizeMode="contain" />
      <Text   style={styles.title}>Log In</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email} onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        value={password} onChangeText={setPassword}
      />

      {loading
        ? <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        : <Button title="Log In" onPress={handleLogin} />
      }

      <TouchableOpacity
        onPress={() => navigation.navigate('Signup')}
        style={styles.link}
      >
        <Text style={styles.linkText}>
          Don't have an account? Sign Up
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  logo:      { width: 150, height: 150, alignSelf: 'center', marginBottom: 30 },
  title:     { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input:     { height: 50, borderColor: '#ccc', borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, marginBottom: 15 },
  loader:    { marginVertical: 20 },
  link:      { marginTop: 20, alignItems: 'center' },
  linkText:  { color: '#4CAF50', fontSize: 16, textDecorationLine: 'underline' }
});
