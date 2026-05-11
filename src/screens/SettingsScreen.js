// src/screens/SettingsScreen.js
// Settings with speech controls, symbol preferences, and attribution.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, brand, spacing, radii } from '../theme';
import { speak, getAvailableVoices } from '../services/speechService';
import { resetAIProfile, hasLearnedData } from '../services/aiProfileStore';
import { clearDismissedSuggestions } from '../components/SmartSuggestionsPanel';
import { setLanguage } from '../i18n/strings';

export default function SettingsScreen() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const navigation = useNavigation();

  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  useEffect(() => {
    getAvailableVoices().then(v => {
      const englishVoices = v.filter(voice => voice.language?.startsWith('en'));
      setVoices(englishVoices);
      setLoadingVoices(false);
    }).catch(() => setLoadingVoices(false));
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
      {/* Theme */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Appearance
      </Text>
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
      <View style={styles.optionRow}>
        {[2, 3, 4].map(size => (
          <TouchableOpacity
            key={size}
            style={[
              styles.optionBtn,
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
              fontSize: 18, fontWeight: '600',
            }}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>High Contrast</Text>
        <Switch
          value={settings.contrast}
          onValueChange={(val) => updateSettings({ contrast: val, theme: val ? 'highContrast' : 'light' })}
          accessibilityLabel="Toggle high contrast mode"
        />
      </View>

      {/* Speech */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Speech
      </Text>

      <Text style={[styles.label, { color: palette.text }]}>
        Speed: {settings.speechRate?.toFixed(1) || '1.0'}x
      </Text>
      <View style={styles.optionRow}>
        {[0.5, 0.75, 1.0, 1.25, 1.5].map(rate => (
          <TouchableOpacity
            key={rate}
            style={[styles.rateBtn, {
              backgroundColor: settings.speechRate === rate ? palette.primary : palette.surface,
              borderColor: palette.border,
            }]}
            onPress={() => updateSettings({ speechRate: rate })}
            accessibilityRole="button"
            accessibilityLabel={`Speed ${rate}x`}
            accessibilityState={{ selected: settings.speechRate === rate }}
          >
            <Text style={{ color: settings.speechRate === rate ? '#FFF' : palette.text, fontSize: 14, fontWeight: '500' }}>
              {rate}x
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: palette.text }]}>
        Pitch: {settings.speechPitch?.toFixed(1) || '1.0'}
      </Text>
      <View style={styles.optionRow}>
        {[0.5, 0.75, 1.0, 1.25, 1.5].map(pitch => (
          <TouchableOpacity
            key={pitch}
            style={[styles.rateBtn, {
              backgroundColor: settings.speechPitch === pitch ? palette.primary : palette.surface,
              borderColor: palette.border,
            }]}
            onPress={() => updateSettings({ speechPitch: pitch })}
            accessibilityRole="button"
            accessibilityLabel={`Pitch ${pitch}`}
            accessibilityState={{ selected: settings.speechPitch === pitch }}
          >
            <Text style={{ color: settings.speechPitch === pitch ? '#FFF' : palette.text, fontSize: 14, fontWeight: '500' }}>
              {pitch}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
                <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
              ))}
            </Picker>
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
        onPress={testSpeech}
        accessibilityRole="button"
        accessibilityLabel="Test speech"
      >
        <Text style={styles.primaryBtnText}>Test Speech</Text>
      </TouchableOpacity>

      {/* Language */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Language
      </Text>
      <Text style={[styles.label, { color: palette.text }]}>Communication language</Text>
      <View style={[styles.pickerContainer, { borderColor: palette.border }]}>
        <Picker
          selectedValue={settings.communicationLanguage || 'en'}
          onValueChange={(val) => {
            updateSettings({ communicationLanguage: val });
            setLanguage(val);
          }}
          style={{ color: palette.text }}
          dropdownIconColor={palette.text}
          accessibilityLabel="Select communication language"
        >
          <Picker.Item label="English" value="en" />
          <Picker.Item label="Español" value="es" />
          <Picker.Item label="Français" value="fr" />
          <Picker.Item label="Deutsch" value="de" />
          <Picker.Item label="Português" value="pt" />
          <Picker.Item label="العربية" value="ar" />
        </Picker>
      </View>

      {/* Symbol Preferences */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Symbols & Pictures
      </Text>

      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Show pictures with words</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Display pictograms alongside word labels on the AAC board.
          </Text>
        </View>
        <Switch
          value={settings.showSymbols !== false}
          onValueChange={(val) => updateSettings({ showSymbols: val })}
          accessibilityLabel="Toggle symbol display"
        />
      </View>

      <Text style={[styles.label, { color: palette.text }]}>Preferred symbol style</Text>
      <View style={styles.optionRow}>
        {[
          { id: 'auto', label: 'Auto' },
          { id: 'arasaac', label: 'Pictograms' },
          { id: 'openmoji', label: 'Emoji-style' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.optionBtn, {
              backgroundColor: (settings.preferredSymbolSource || 'auto') === opt.id ? palette.primary : palette.surface,
              borderColor: palette.border,
            }]}
            onPress={() => updateSettings({ preferredSymbolSource: opt.id })}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: (settings.preferredSymbolSource || 'auto') === opt.id }}
          >
            <Text style={{
              color: (settings.preferredSymbolSource || 'auto') === opt.id ? '#FFF' : palette.text,
              fontSize: 14, fontWeight: '600',
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Communication Features */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Communication
      </Text>
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Emergency SOS</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Floating emergency button on all screens.
          </Text>
        </View>
        <Switch
          value={settings.crisisModeEnabled !== false}
          onValueChange={(val) => updateSettings({ crisisModeEnabled: val })}
          accessibilityLabel="Toggle emergency SOS"
        />
      </View>
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Listener Display</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Show spoken text in large print after speaking.
          </Text>
        </View>
        <Switch
          value={settings.listenerModeEnabled === true}
          onValueChange={(val) => updateSettings({ listenerModeEnabled: val })}
          accessibilityLabel="Toggle listener display"
        />
      </View>
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Partner Coach</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Tips for conversation partners.
          </Text>
        </View>
        <Switch
          value={settings.partnerCoachEnabled !== false}
          onValueChange={(val) => updateSettings({ partnerCoachEnabled: val })}
          accessibilityLabel="Toggle partner coaching"
        />
      </View>

      {/* Switch Scanning */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Switch Scanning
      </Text>

      <Text style={[styles.label, { color: palette.text }]}>Scan Mode</Text>
      <View style={styles.optionRow}>
        {[
          { id: 'auto', label: 'Auto' },
          { id: 'step', label: 'Step' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.optionBtn, {
              backgroundColor: (settings.scanMode || 'auto') === opt.id ? palette.primary : palette.surface,
              borderColor: palette.border,
            }]}
            onPress={() => updateSettings({ scanMode: opt.id })}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} scan mode`}
            accessibilityState={{ selected: (settings.scanMode || 'auto') === opt.id }}
          >
            <Text style={{
              color: (settings.scanMode || 'auto') === opt.id ? '#FFF' : palette.text,
              fontSize: 16, fontWeight: '600',
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: palette.text }]}>
        Scan Speed: {((settings.scanSpeed || 1500) / 1000).toFixed(1)}s
      </Text>
      <View style={styles.optionRow}>
        {[1000, 1500, 2000, 3000].map(speed => (
          <TouchableOpacity
            key={speed}
            style={[styles.rateBtn, {
              backgroundColor: (settings.scanSpeed || 1500) === speed ? palette.primary : palette.surface,
              borderColor: palette.border,
            }]}
            onPress={() => updateSettings({ scanSpeed: speed })}
            accessibilityRole="button"
            accessibilityLabel={`Scan every ${speed / 1000} seconds`}
            accessibilityState={{ selected: (settings.scanSpeed || 1500) === speed }}
          >
            <Text style={{ color: (settings.scanSpeed || 1500) === speed ? '#FFF' : palette.text, fontSize: 14, fontWeight: '500' }}>
              {speed / 1000}s
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        AI Learning
      </Text>
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Learn from usage</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Improve suggestions based on your patterns. All data stays on-device.
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
          style={[styles.primaryBtn, { backgroundColor: palette.danger, marginTop: 8 }]}
          onPress={() => {
            Alert.alert('Reset AI Data', 'Clear all learned patterns? This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => resetAIProfile().then(() => Alert.alert('Done', 'AI data has been reset.')) },
            ]);
          }}
          accessibilityRole="button"
          accessibilityLabel="Reset AI data"
        >
          <Text style={styles.primaryBtnText}>Reset AI Data</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: palette.info, marginTop: 8 }]}
        onPress={() => {
          Alert.alert('Reset Dismissed Suggestions', 'Dismissed suggestions will reappear.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', onPress: () => clearDismissedSuggestions().then(() => Alert.alert('Done', 'Suggestions restored.')) },
          ]);
        }}
        accessibilityRole="button"
        accessibilityLabel="Reset dismissed suggestions"
      >
        <Text style={styles.primaryBtnText}>Reset Dismissed Suggestions</Text>
      </TouchableOpacity>

      {/* Feedback */}
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: palette.info, marginTop: 24 }]}
        onPress={() => navigation.navigate('Feedback')}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Text style={styles.primaryBtnText}>Send Feedback</Text>
      </TouchableOpacity>

      {/* Symbol Attribution */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        About Symbols
      </Text>
      <View style={[styles.attributionCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        <Text style={[styles.attributionTitle, { color: palette.text }]}>ARASAAC Pictograms</Text>
        <Text style={[styles.attributionBody, { color: palette.textSecondary }]}>
          {'©'} Government of Arag{'ó'}n, created by Sergio Palao{'\n'}
          License: CC BY-NC-SA 3.0{'\n'}
          arasaac.org
        </Text>
      </View>
      <View style={[styles.attributionCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        <Text style={[styles.attributionTitle, { color: palette.text }]}>OpenMoji</Text>
        <Text style={[styles.attributionBody, { color: palette.textSecondary }]}>
          {'©'} HfG Schw{'ä'}bisch Gm{'ü'}nd{'\n'}
          License: CC BY-SA 4.0{'\n'}
          openmoji.org
        </Text>
      </View>
      <View style={[styles.attributionCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        <Text style={[styles.attributionTitle, { color: palette.text }]}>Mulberry Symbols</Text>
        <Text style={[styles.attributionBody, { color: palette.textSecondary }]}>
          {'©'} Steve Lee{'\n'}
          License: CC BY-SA 2.0 UK{'\n'}
          mulberrysymbols.org
        </Text>
      </View>

      {/* Privacy & Version */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]}>
        Legal
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
        {brand.name} v1.3.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 20, fontWeight: '700', marginTop: 28, marginBottom: 12,
    paddingBottom: 8, borderBottomWidth: 1,
  },
  label: { fontSize: 18, marginTop: 16, marginBottom: 8, fontWeight: '600' },
  pickerContainer: { borderWidth: 1, borderRadius: radii.md, marginBottom: 8, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  optionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.md,
    borderWidth: 1, alignItems: 'center', minHeight: 48,
    justifyContent: 'center',
  },
  rateBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radii.sm,
    borderWidth: 1, alignItems: 'center', minHeight: 48,
    justifyContent: 'center',
  },
  switchContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginVertical: 12,
  },
  helperText: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  primaryBtn: {
    marginTop: 20, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  attributionCard: {
    padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1,
    marginBottom: spacing.md,
  },
  attributionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  attributionBody: { fontSize: 14, lineHeight: 20 },
  linkRow: { paddingVertical: 12 },
  linkText: { fontSize: 16, textDecorationLine: 'underline' },
  versionText: { fontSize: 13, textAlign: 'center', marginTop: 16, marginBottom: 8 },
});
