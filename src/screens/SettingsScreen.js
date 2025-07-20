// src/screens/SettingsScreen.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Button,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';

export default function SettingsScreen() {
  const { settings, loading: settingsLoading } = useSettings();
  const [theme, setTheme]       = useState(settings.theme);
  const [gridSize, setGridSize] = useState(settings.gridSize);
  const [contrast, setContrast] = useState(settings.contrast);

  // Once the context finishes loading, seed our local form state
  useEffect(() => {
    if (!settingsLoading) {
      setTheme(settings.theme);
      setGridSize(settings.gridSize);
      setContrast(settings.contrast);
    }
  }, [settingsLoading, settings]);

  // Write back to Firebase
  const saveSettings = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return Alert.alert('Error', 'No user is signed in.');

    try {
      await set(ref(getDatabase(), `userSettings/${uid}`), {
        theme,
        gridSize,
        contrast,
      });
      Alert.alert('Success', 'Settings saved.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Show spinner while context is loading
  if (settingsLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Personalise Your Experience</Text>

      <Text style={styles.label}>Theme</Text>
      <Picker
        selectedValue={theme}
        onValueChange={(val) => setTheme(val)}
      >
        <Picker.Item label="Light" value="light" />
        <Picker.Item label="Dark" value="dark" />
        <Picker.Item label="High Contrast" value="highContrast" />
      </Picker>

      <Text style={styles.label}>Grid Size</Text>
      <Picker
        selectedValue={gridSize}
        onValueChange={(val) => setGridSize(Number(val))}
      >
        <Picker.Item label="2 columns" value={2} />
        <Picker.Item label="3 columns" value={3} />
        <Picker.Item label="4 columns" value={4} />
      </Picker>

      <View style={styles.switchContainer}>
        <Text style={styles.label}>Enable High Contrast</Text>
        <Switch
          value={contrast}
          onValueChange={(val) => setContrast(val)}
        />
      </View>

      <Button
        title="Save Settings"
        onPress={saveSettings}
        color="#4CAF50"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:       1,
    padding:    20,
    backgroundColor: '#fff',
  },
  center: {
    justifyContent: 'center',
    alignItems:     'center',
  },
  heading: {
    fontSize:   24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    marginTop: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginVertical:  15,
  },
});
