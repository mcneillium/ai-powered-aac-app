import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;

  const palettes = {
    light: { background: '#fff', text: '#000' },
    dark: { background: '#000', text: '#fff' },
    highContrast: { background: '#000', text: '#FFD600' }
  };
  const palette = palettes[settings.theme];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (e) {
      Alert.alert('Error', 'Could not log out.');
    }
  };

  if (settingsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>  
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>  
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: '#4CAF50' }]}>  
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: palette.text }]}>Welcome!</Text>
        <Text style={[styles.email, { color: palette.text }]}>{user?.email || 'Guest'}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialIcons name="settings" size={20} color="#fff" />
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#f44336' }]}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.actionText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  profileCard: {
    width: '100%',
    backgroundColor: '#ececec',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold'
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4
  },
  email: {
    fontSize: 16,
    color: '#666'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%'
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8
  },
  actionText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500'
  }
});
