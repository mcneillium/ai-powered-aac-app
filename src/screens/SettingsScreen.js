// src/screens/SettingsScreen.js
// Offline-first settings with speech controls.
// Uses updateSettings() which writes to AsyncStorage first, then syncs to Firebase.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, brand } from '../theme';
import { speak, getAvailableVoices } from '../services/speechService';
import { resetAIProfile, hasLearnedData } from '../services/aiProfileStore';

export default function SettingsScreen() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const navigation = useNavigation();

  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  useEffect(() => {
    getAvailableVoices().then(v => {
      // Filter to English voices for now; multilingual support in V1
      const englishVoices = v.filter(voice =>
        voice.language?.startsWith('en')
      );
      setVoices(englishVoices);
      setLoadingVoices(false);
    });
  }, []);

  const testSpeech = () => {
    speak('This is how I will sound when communicating.', {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  };

  if (settingsLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: palette.text }]}>
        Personalise Your Experience
      </Text>

      {/* Theme */}
      <Text style={[styles.label, { color: palette.text }]}>Theme</Text>
      <View style={[styles.pickerContainer, { borderColor: palette.border }]}>
        <Picker
          selectedValue={settings.theme}
          onValueChange={(val) => updateSettings({ theme: val })}
          style={{ color: palette.text }}
          dropdownIconColor={palette.text}
          accessibilityLabel="Select theme"
        >
          <Picker.Item label="Light" value="light" />
          <Picker.Item label="Dark" value="dark" />
          <Picker.Item label="High Contrast" value="highContrast" />
        </Picker>
      </View>

      {/* Grid Size */}
      <Text style={[styles.label, { color: palette.text }]}>Grid Size</Text>
      <View style={styles.gridSizeRow}>
        {[2, 3, 4].map(size => (
          <TouchableOpacity
            key={size}
            style={[
              styles.gridSizeBtn,
              {
                backgroundColor: settings.gridSize === size ? palette.primary : palette.surface,
                borderColor: palette.border,
              },
            ]}
            onPress={() => updateSettings({ gridSize: size })}
            accessibilityRole="button"
            accessibilityLabel={`${size} columns`}
            accessibilityState={{ selected: settings.gridSize === size }}
          >
            <Text style={{
              color: settings.gridSize === size ? '#FFF' : palette.text,
              fontSize: 18,
              fontWeight: '600',
            }}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Speech Rate */}
      <Text style={[styles.label, { color: palette.text }]}>
        Speech Speed: {settings.speechRate?.toFixed(1) || '1.0'}x
      </Text>
      <View style={styles.sliderRow}>
        <Text style={[styles.sliderLabel, { color: palette.textSecondary }]}>Slow</Text>
        <View style={styles.sliderButtons}>
          {[0.5, 0.75, 1.0, 1.25, 1.5].map(rate => (
            <TouchableOpacity
              key={rate}
              style={[
                styles.rateBtn,
                {
                  backgroundColor: settings.speechRate === rate ? palette.primary : palette.surface,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => updateSettings({ speechRate: rate })}
              accessibilityRole="button"
              accessibilityLabel={`Speech speed ${rate}x`}
              accessibilityState={{ selected: settings.speechRate === rate }}
            >
              <Text style={{
                color: settings.speechRate === rate ? '#FFF' : palette.text,
                fontSize: 14,
                fontWeight: '500',
              }}>
                {rate}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.sliderLabel, { color: palette.textSecondary }]}>Fast</Text>
      </View>

      {/* Speech Pitch */}
      <Text style={[styles.label, { color: palette.text }]}>
        Speech Pitch: {settings.speechPitch?.toFixed(1) || '1.0'}
      </Text>
      <View style={styles.sliderRow}>
        <Text style={[styles.sliderLabel, { color: palette.textSecondary }]}>Low</Text>
        <View style={styles.sliderButtons}>
          {[0.5, 0.75, 1.0, 1.25, 1.5].map(pitch => (
            <TouchableOpacity
              key={pitch}
              style={[
                styles.rateBtn,
                {
                  backgroundColor: settings.speechPitch === pitch ? palette.primary : palette.surface,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => updateSettings({ speechPitch: pitch })}
              accessibilityRole="button"
              accessibilityLabel={`Speech pitch ${pitch}`}
              accessibilityState={{ selected: settings.speechPitch === pitch }}
            >
              <Text style={{
                color: settings.speechPitch === pitch ? '#FFF' : palette.text,
                fontSize: 14,
                fontWeight: '500',
              }}>
                {pitch}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.sliderLabel, { color: palette.textSecondary }]}>High</Text>
      </View>

      {/* Voice Selection */}
      {!loadingVoices && voices.length > 0 && (
        <>
          <Text style={[styles.label, { color: palette.text }]}>Voice</Text>
          <View style={[styles.pickerContainer, { borderColor: palette.border }]}>
            <Picker
              selectedValue={settings.speechVoice || ''}
              onValueChange={(val) => updateSettings({ speechVoice: val || null })}
              style={{ color: palette.text }}
              dropdownIconColor={palette.text}
              accessibilityLabel="Select voice"
            >
              <Picker.Item label="System Default" value="" />
              {voices.map(v => (
                <Picker.Item
                  key={v.identifier}
                  label={v.name || v.identifier}
                  value={v.identifier}
                />
              ))}
            </Picker>
          </View>
        </>
      )}

      {/* Test Speech Button */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: palette.primary }]}
        onPress={testSpeech}
        accessibilityRole="button"
        accessibilityLabel="Test speech with current settings"
      >
        <Text style={styles.testButtonText}>Test Speech</Text>
      </TouchableOpacity>

      {/* High Contrast Toggle */}
      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: palette.text }]}>High Contrast Mode</Text>
        <Switch
          value={settings.contrast}
          onValueChange={(val) => {
            updateSettings({
              contrast: val,
              theme: val ? 'highContrast' : 'light',
            });
          }}
          accessibilityLabel="Toggle high contrast mode"
        />
      </View>

      {/* AI Personalisation */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        AI Personalisation
      </Text>
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Learn from my usage</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Improves suggestions based on your communication patterns. All data stays on-device.
          </Text>
        </View>
        <Switch
          value={settings.aiPersonalisationEnabled !== false}
          onValueChange={(val) => updateSettings({ aiPersonalisationEnabled: val })}
          accessibilityLabel="Toggle AI personalisation"
        />
      </View>

      {hasLearnedData() && (
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: palette.danger, marginTop: 8 }]}
          onPress={() => {
            Alert.alert(
              'Reset AI Data',
              'This will clear all learned communication patterns and suggestions will start fresh. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: () => {
                    resetAIProfile().then(() => {
                      Alert.alert('Done', 'AI personalisation data has been reset.');
                    });
                  },
                },
              ]
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Reset AI personalisation data"
        >
          <Text style={styles.testButtonText}>Reset AI Data</Text>
        </TouchableOpacity>
      )}

      {/* Send Feedback */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: palette.info, marginTop: 24 }]}
        onPress={() => navigation.navigate('Feedback')}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Text style={styles.testButtonText}>Send Feedback</Text>
      </TouchableOpacity>

      {/* About & Legal */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        About
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openURL(brand.privacyPolicyUrl)}
        accessibilityRole="link"
        accessibilityLabel="Open privacy policy"
        style={styles.linkRow}
      >
        <Text style={[styles.linkText, { color: palette.primary }]}>Privacy Policy</Text>
      </TouchableOpacity>
      <Text style={[styles.versionText, { color: palette.textSecondary }]}>
        {brand.name} v1.1.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  gridSizeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  gridSizeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sliderLabel: {
    fontSize: 12,
  },
  sliderButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  rateBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  helperText: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  testButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  linkRow: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  versionText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
});
