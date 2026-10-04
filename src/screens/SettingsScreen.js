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
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, brand } from '../theme';
import { speak, getAvailableVoices, buildSpeechOptions } from '../services/speechService';
import { resetAIProfile, hasLearnedData } from '../services/aiProfileStore';
import { resetLearning, setLearningEnabled } from '../services/suggestionEngine';
import {
  loadPronunciations, getPronunciations, setPronunciation, removePronunciation,
} from '../services/pronunciationStore';
import packageJson from '../../package.json';
import CloudUnavailableNotice from '../components/CloudUnavailableNotice';

export default function SettingsScreen() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const palette = getPalette(settings.theme, settings.boardLayout);
  const navigation = useNavigation();

  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [learnedData, setLearnedData] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowHeight < 700;
  const [pronunciations, setPronunciations] = useState([]);
  const [newWritten, setNewWritten] = useState('');
  const [newSpoken, setNewSpoken] = useState('');

  useEffect(() => {
    loadPronunciations().then(list => setPronunciations([...list])).catch(() => {});
  }, []);

  const addPronunciation = async () => {
    const saved = await setPronunciation(newWritten, newSpoken);
    if (!saved) {
      Alert.alert('Pronunciation', 'Enter both the word and how it should sound.');
      return;
    }
    setPronunciations([...getPronunciations()]);
    setNewWritten('');
    setNewSpoken('');
    speak(saved.written, buildSpeechOptions(settings));
  };

  // A labelled on/off row. The whole row is one accessible switch so screen
  // reader and switch users get the label, state and action together.
  const switchRow = (label, helper, value, onChange) => (
    <View
      style={styles.switchContainer}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={helper}
      accessibilityState={{ checked: value }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onChange(!value)}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>{label}</Text>
        {helper ? (
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>{helper}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );

  useEffect(() => {
    let cancelled = false;
    getAvailableVoices()
      .then(v => {
        if (cancelled) return;
        // Filter to English voices for now; multilingual support in V1
        const englishVoices = v.filter(voice =>
          voice.language?.startsWith('en')
        );
        setVoices(englishVoices);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVoices(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setLearnedData(hasLearnedData());
  }, []);

  const testSpeech = () => {
    speak('This is how I will sound when communicating.', buildSpeechOptions(settings));
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
              color: settings.gridSize === size ? palette.buttonText : palette.text,
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
                color: settings.speechRate === rate ? palette.buttonText : palette.text,
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
                color: settings.speechPitch === pitch ? palette.buttonText : palette.text,
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

      {!loadingVoices && voices.length === 0 && (
        <Text style={[styles.helperText, { color: palette.textSecondary, marginTop: 8 }]} accessibilityLiveRegion="polite">
          No English text-to-speech voices were found on this device. Speech may not work until a voice is installed (Android: Settings › Accessibility › Text-to-speech; iOS: Settings › Accessibility › Spoken Content › Voices). Messages can always be shown on screen instead.
        </Text>
      )}

      {/* Test Speech Button */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: palette.primary }]}
        onPress={testSpeech}
        accessibilityRole="button"
        accessibilityLabel="Test speech with current settings"
      >
        <Text style={[styles.testButtonText, { color: palette.buttonText }]}>Test Speech</Text>
      </TouchableOpacity>

      {/* Pronunciation dictionary */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]} accessibilityRole="header">
        Pronunciation
      </Text>
      <Text style={[styles.helperText, { color: palette.textSecondary }]}>
        Fix how the voice says names or words. Only the spoken sound changes — the words on screen stay the same. Saved on this device.
      </Text>
      <View style={styles.pronRow}>
        <TextInput
          value={newWritten}
          onChangeText={setNewWritten}
          placeholder="Word (e.g. Siobhan)"
          placeholderTextColor={palette.textSecondary}
          autoCorrect={false}
          style={[styles.pronInput, { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
          accessibilityLabel="Word as written"
        />
        <TextInput
          value={newSpoken}
          onChangeText={setNewSpoken}
          placeholder="Say it as (e.g. Shivawn)"
          placeholderTextColor={palette.textSecondary}
          autoCorrect={false}
          style={[styles.pronInput, { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
          accessibilityLabel="How it should sound"
        />
      </View>
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: palette.primary, marginTop: 8 }]}
        onPress={addPronunciation}
        accessibilityRole="button"
        accessibilityLabel="Save pronunciation and hear it"
      >
        <Text style={[styles.testButtonText, { color: palette.buttonText }]}>Save and Listen</Text>
      </TouchableOpacity>
      {pronunciations.map(entry => (
        <View key={entry.id} style={[styles.pronItem, { borderBottomColor: palette.border }]}>
          <TouchableOpacity
            style={styles.pronItemMain}
            onPress={() => speak(entry.written, buildSpeechOptions(settings))}
            accessibilityRole="button"
            accessibilityLabel={`${entry.written}, said as ${entry.spoken}. Tap to listen.`}
          >
            <Text style={[styles.pronItemText, { color: palette.text }]}>
              {entry.written} → {entry.spoken}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pronRemove}
            onPress={async () => {
              await removePronunciation(entry.id);
              setPronunciations([...getPronunciations()]);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove pronunciation for ${entry.written}`}
          >
            <Text style={{ color: palette.danger, fontWeight: '600' }}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Board & communication preferences — all optional; defaults keep the
          original layout so learned button positions are preserved. */}
      <Text style={[styles.sectionTitle, { color: palette.text, borderBottomColor: palette.border }]} accessibilityRole="header">
        Board & Communication
      </Text>
      <Text style={[styles.label, { color: palette.text }]}>Board design</Text>
      <View style={styles.gridSizeRow}>
        {[['studio', 'New Voice'], ['classic', 'Classic']].map(([value, name]) => {
          const on = (settings.boardLayout || 'studio') === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => updateSettings({ boardLayout: value })}
              style={[styles.gridSizeBtn, { backgroundColor: on ? palette.primary : palette.surface, borderColor: palette.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${name} board design`}
            >
              <Text style={{ color: on ? palette.buttonText : palette.text, fontWeight: '600' }}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.helperText, { color: palette.textSecondary, marginBottom: 8 }]}>
        The new design adds Child and Adult modes, picture symbols, Help me explain and phrase panels. Classic keeps the familiar board. Your words, favourites and messages are the same in both, and you can switch back any time.
      </Text>
      {switchRow(
        'Compact layout',
        'For small screens. Puts the most-used actions in one row (favourites, history and voice style move into a More menu) and hides the page header, so more words fit. Changes where some buttons are, so it is off unless you turn it on.',
        settings.compactLayout === true,
        (val) => updateSettings({ compactLayout: val })
      )}
      {isSmallScreen && settings.compactLayout !== true && (
        <Text style={[styles.helperText, { color: palette.textSecondary, marginTop: -8, marginBottom: 8 }]}>
          This screen is small. Compact layout shows about twice as many rows of words.
        </Text>
      )}
      <Text style={[styles.label, { color: palette.text }]}>Button Text Size</Text>
      <View style={styles.gridSizeRow}>
        {[[1, 'Standard'], [1.25, 'Large'], [1.5, 'Extra large']].map(([scale, name]) => {
          const selected = (settings.textScale || 1) === scale;
          return (
            <TouchableOpacity
              key={scale}
              style={[styles.gridSizeBtn, { backgroundColor: selected ? palette.primary : palette.surface, borderColor: palette.border }]}
              onPress={() => updateSettings({ textScale: scale })}
              accessibilityRole="button"
              accessibilityLabel={`${name} button text`}
              accessibilityState={{ selected }}
            >
              <Text style={{ color: selected ? palette.buttonText : palette.text, fontSize: 14 * scale, fontWeight: '600' }}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {switchRow(
        'Speak each word when tapped',
        'Turn off to build the whole sentence quietly and speak it with the Speak button.',
        settings.speakWordsOnTap !== false,
        (val) => updateSettings({ speakWordsOnTap: val })
      )}
      {switchRow(
        'Word suggestions',
        'Shows a row of suggested next words. Suggestions are only added when you tap them.',
        settings.predictionEnabled !== false,
        (val) => updateSettings({ predictionEnabled: val })
      )}
      {switchRow(
        'Show voice styles bar',
        'Calm, excited and other voice styles on the board.',
        settings.showVoiceStyles !== false,
        (val) => updateSettings({ showVoiceStyles: val })
      )}
      <Text style={[styles.label, { color: palette.text }]}>Switch scanning</Text>
      <View style={styles.gridSizeRow}>
        {[['auto', 'Auto scan'], ['step', 'Step scan']].map(([mode, name]) => {
          const selected = (settings.scanMode || 'auto') === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.gridSizeBtn, { backgroundColor: selected ? palette.primary : palette.surface, borderColor: palette.border }]}
              onPress={() => updateSettings({ scanMode: mode })}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{ selected }}
            >
              <Text style={{ color: selected ? palette.buttonText : palette.text, fontSize: 15, fontWeight: '600' }}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.gridSizeRow}>
        <TouchableOpacity
          style={[styles.gridSizeBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={() => updateSettings({ scanSpeed: Math.min(5000, (settings.scanSpeed || 1500) + 500) })}
          accessibilityRole="button"
          accessibilityLabel={`Scan slower. Currently ${((settings.scanSpeed || 1500) / 1000).toFixed(1)} seconds per item`}
        >
          <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>Slower</Text>
        </TouchableOpacity>
        <Text style={[styles.label, { color: palette.text, marginTop: 0, alignSelf: 'center' }]}>
          {((settings.scanSpeed || 1500) / 1000).toFixed(1)}s
        </Text>
        <TouchableOpacity
          style={[styles.gridSizeBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={() => updateSettings({ scanSpeed: Math.max(500, (settings.scanSpeed || 1500) - 500) })}
          accessibilityRole="button"
          accessibilityLabel={`Scan faster. Currently ${((settings.scanSpeed || 1500) / 1000).toFixed(1)} seconds per item`}
        >
          <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }}>Faster</Text>
        </TouchableOpacity>
      </View>
      {switchRow(
        'Show switch scanning bar',
        'Scanning controls on the board for switch users.',
        settings.showScanControls !== false,
        (val) => updateSettings({ showScanControls: val })
      )}

      {/* High Contrast Toggle */}
      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: palette.text }]}>High Contrast Mode</Text>
        <Switch
          value={settings.contrast}
          onValueChange={(val) => {
            updateSettings({
              contrast: val,
              // Turning high contrast off returns to light only if high
              // contrast was active; otherwise keep the chosen theme.
              theme: val ? 'highContrast' : (settings.theme === 'highContrast' ? 'light' : settings.theme),
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
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Learn from my messages</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            {settings.learningCarriedOver && settings.personalLearning === true ? 'On because it was on in your earlier version of Voice. ' : 'Off until you turn it on. '}When on, Voice counts the words you use together in messages you speak, on this device, to improve suggestions. Taps you delete are never learned. If you sign in, this choice applies on your other devices too.
          </Text>
        </View>
        <Switch
          value={settings.personalLearning === true}
          onValueChange={(val) => { updateSettings({ personalLearning: val, aiPersonalisationEnabled: true, learningCarriedOver: false }); setLearningEnabled(val); }}
          accessibilityLabel="Learn from my messages"
        />
      </View>

      <CloudUnavailableNotice feature="Online suggestions and cloud sync" />
      <View style={styles.switchContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.text, marginTop: 0 }]}>Online suggestions</Text>
          <Text style={[styles.helperText, { color: palette.textSecondary }]}>
            Sends your current sentence and recent phrases (never your name or email) to our secure server to generate better phrase suggestions. Turn off to keep all communication on-device.
          </Text>
        </View>
        <Switch
          value={settings.cloudSuggestionsEnabled === true}
          onValueChange={(val) => updateSettings({ cloudSuggestionsEnabled: val })}
          accessibilityLabel="Toggle online AI suggestions"
        />
      </View>

      {learnedData && (
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
                    Promise.all([resetAIProfile(), resetLearning()])
                      .then(() => {
                        setLearnedData(false);
                        Alert.alert('Done', 'AI personalisation data has been reset.');
                      })
                      .catch(() => {
                        Alert.alert('Error', 'Could not reset AI data. Please try again.');
                      });
                  },
                },
              ]
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Reset AI personalisation data"
        >
          <Text style={[styles.testButtonText, { color: palette.buttonText }]}>Reset AI Data</Text>
        </TouchableOpacity>
      )}

      {/* Send Feedback */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: palette.info, marginTop: 24 }]}
        onPress={() => navigation.navigate('Feedback')}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Text style={[styles.testButtonText, { color: palette.buttonText }]}>Send Feedback</Text>
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
      <Text style={[styles.helperText, { color: palette.textSecondary, marginTop: 8 }]}>
        Pictograms' author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain).
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Licenses')}
        accessibilityRole="link"
        accessibilityLabel="Credits and open-source licences"
        style={styles.linkRow}
      >
        <Text style={[styles.linkText, { color: palette.primary }]}>Credits & open-source licences</Text>
      </TouchableOpacity>
      <Text style={[styles.versionText, { color: palette.textSecondary }]}>
        {brand.name} v{packageJson.version}
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
    fontSize: 18,
    fontWeight: '600',
  },
  pronRow: { gap: 8, marginTop: 12 },
  pronInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 48, fontSize: 16 },
  pronItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  pronItemMain: { flex: 1, minHeight: 48, justifyContent: 'center' },
  pronItemText: { fontSize: 16 },
  pronRemove: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
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
