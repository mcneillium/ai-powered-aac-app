// src/screens/SettingsScreen.js
// Personalise Voice: who is using it, how it looks, how it sounds, how the
// board behaves, and what it learns. Offline-first: updateSettings() writes
// to AsyncStorage first, then syncs to Firebase when signed in.
//
// Nothing on this screen moves a word on the board except Grid size, which
// says so.

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
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, getExperience, symbolsOn, brand, fonts, radii, spacing } from '../theme';
import { speak, getAvailableVoices, buildSpeechOptions } from '../services/speechService';
import { hasLearnedData } from '../services/aiProfileStore';
import {
  loadPronunciations, getPronunciations, setPronunciation, removePronunciation,
} from '../services/pronunciationStore';
import packageJson from '../../package.json';
import CloudUnavailableNotice from '../components/CloudUnavailableNotice';

export default function SettingsScreen() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
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

  useEffect(() => {
    let cancelled = false;
    getAvailableVoices()
      .then(v => {
        if (cancelled) return;
        setVoices(v.filter(voice => voice.language?.startsWith('en')));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVoices(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setLearnedData(hasLearnedData());
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

  const testSpeech = () => {
    speak('This is how I will sound when communicating.', buildSpeechOptions(settings));
  };

  const chooseExperience = (id) => {
    if (id === settings.experience) return;
    const next = getExperience(id);
    Alert.alert(
      `Switch to ${next.label}?`,
      `${next.label} changes how Voice looks and talks to you. Every word stays in the same place.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Use ${next.label}`, onPress: () => updateSettings({ experience: id }) },
      ]
    );
  };

  const chooseTheme = (theme) => {
    updateSettings({ theme, contrast: theme === 'highContrast' });
  };

  if (settingsLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  // ── Building blocks ──
  // A labelled on/off row. The whole row is one accessible switch so screen
  // reader and switch users get the label, state and action together.
  // The whole row is the touch target, not just the small switch.
  const switchRow = (label, helper, value, onChange) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onChange(!value)}
      style={styles.switchRow}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={helper}
      accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        {helper ? <Text style={[styles.helper, { color: palette.textSecondary }]}>{helper}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: palette.primary, false: palette.border }} thumbColor={value ? palette.cardBg : palette.surface} importantForAccessibility="no-hide-descendants" />
    </TouchableOpacity>
  );

  // Segmented choice: equal buttons, the chosen one filled.
  const segmented = (options, selectedValue, onSelect, a11y) => (
    <View style={[styles.segment, { backgroundColor: palette.surface }]}>
      {options.map(([value, text, extraStyle]) => {
        const selected = selectedValue === value;
        return (
          <TouchableOpacity
            key={String(value)}
            style={[styles.segmentBtn, selected && { backgroundColor: palette.primary }]}
            onPress={() => onSelect(value)}
            accessibilityRole="button"
            accessibilityLabel={a11y ? a11y(value, text) : text}
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.segmentText, { color: selected ? palette.buttonText : palette.text }, extraStyle]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {text}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const divider = <View style={[styles.divider, { backgroundColor: palette.border }]} />;

  const experienceCard = (id, emoji, blurb) => {
    const x = getExperience(id);
    const selected = (settings.experience || 'adult') === id;
    return (
      <TouchableOpacity
        onPress={() => chooseExperience(id)}
        style={[
          styles.modeCard,
          {
            backgroundColor: selected ? palette.primaryMuted : palette.surface,
            borderColor: selected ? palette.primary : 'transparent',
            borderRadius: x.tileRadius,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${x.label}. ${blurb}`}
      >
        <Text style={styles.modeEmoji} importantForAccessibility="no">{emoji}</Text>
        <Text style={[styles.modeTitle, { color: selected ? palette.onPrimaryMuted : palette.text, fontFamily: x.headlineFont }]}>{x.label}</Text>
        <Text style={[styles.modeBlurb, { color: palette.textSecondary }]}>{blurb}</Text>
        {selected ? (
          <View style={[styles.modeTick, { backgroundColor: palette.primary }]}>
            <Ionicons name="checkmark" size={16} color={palette.buttonText} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const picturesOn = symbolsOn(settings);
  const pictureNote = typeof settings.showSymbols === 'boolean'
    ? 'Your choice. Switch Child/Adult and it stays as you set it.'
    : `Following ${experience.label}: ${experience.symbolsByDefault ? 'on' : 'off'}.`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: palette.text, fontFamily: experience.headlineFont }]} accessibilityRole="header">
        Make Voice yours
      </Text>
      <Text style={[styles.subheading, { color: palette.textSecondary }]}>
        Saved on this device. Your words never move unless you change the grid.
      </Text>

      <SettingsSection palette={palette} title="Who is using Voice">
        <View style={styles.modeRow} accessibilityRole="radiogroup">
          {experienceCard('child', '🧒', 'Pictures, bigger tiles, simple words')}
          {experienceCard('adult', '🧑', 'Clean, text-first, more detail')}
        </View>
      </SettingsSection>

      <SettingsSection palette={palette} title="Look">
        <SettingsLabel palette={palette}>Theme</SettingsLabel>
        {segmented(
          [['light', 'Light'], ['dark', 'Dark'], ['highContrast', 'High contrast']],
          settings.theme,
          chooseTheme,
          (v, text) => `${text} theme`
        )}
        {divider}
        {switchRow('Pictures on words', pictureNote, picturesOn, (val) => updateSettings({ showSymbols: val }))}
        {divider}
        <SettingsLabel palette={palette}>Button text size</SettingsLabel>
        {segmented(
          [[1, 'Standard'], [1.25, 'Large', { fontSize: 17 }], [1.5, 'Extra large', { fontSize: 19 }]],
          settings.textScale || 1,
          (v) => updateSettings({ textScale: v }),
          (v, text) => `${text} button text`
        )}
        {divider}
        <SettingsLabel palette={palette} helper="Changing this rearranges the board.">Grid size</SettingsLabel>
        {segmented(
          [[2, '2'], [3, '3'], [4, '4']],
          settings.gridSize,
          (v) => updateSettings({ gridSize: v }),
          (v) => `${v} columns`
        )}
      </SettingsSection>

      <SettingsSection palette={palette} title="Voice">
        <SettingsLabel palette={palette}>{`Speech speed: ${settings.speechRate?.toFixed(2).replace(/0$/, '') || '1.0'}x`}</SettingsLabel>
        {segmented(
          [0.5, 0.75, 1.0, 1.25, 1.5].map(r => [r, `${r}x`]),
          settings.speechRate,
          (v) => updateSettings({ speechRate: v }),
          (v) => `Speech speed ${v}x`
        )}
        {divider}
        <SettingsLabel palette={palette}>{`Speech pitch: ${settings.speechPitch?.toFixed(2).replace(/0$/, '') || '1.0'}`}</SettingsLabel>
        {segmented(
          [0.5, 0.75, 1.0, 1.25, 1.5].map(r => [r, `${r}`]),
          settings.speechPitch,
          (v) => updateSettings({ speechPitch: v }),
          (v) => `Speech pitch ${v}`
        )}
        {!loadingVoices && voices.length > 0 && (
          <>
            {divider}
            <SettingsLabel palette={palette}>Voice</SettingsLabel>
            <View style={[styles.pickerContainer, { borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}>
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
        {!loadingVoices && voices.length === 0 && (
          <Text style={[styles.helper, { color: palette.textSecondary, marginTop: 8 }]} accessibilityLiveRegion="polite">
            No English text-to-speech voices were found on this device. Speech may not work until a voice is installed (Android: Settings › Accessibility › Text-to-speech; iOS: Settings › Accessibility › Spoken Content › Voices). Messages can always be shown on screen instead.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={testSpeech}
          accessibilityRole="button"
          accessibilityLabel="Test speech with current settings"
        >
          <Ionicons name="volume-high" size={20} color={palette.buttonText} />
          <Text style={[styles.primaryBtnText, { color: palette.buttonText }]}>Test speech</Text>
        </TouchableOpacity>
      </SettingsSection>

      <SettingsSection palette={palette} title="Pronunciation">
        <Text style={[styles.helper, { color: palette.textSecondary }]}>
          Fix how the voice says names or words. Only the spoken sound changes — the words on screen stay the same. Saved on this device.
        </Text>
        <View style={styles.pronRow}>
          <TextInput
            value={newWritten}
            onChangeText={setNewWritten}
            placeholder="Word (e.g. Siobhan)"
            placeholderTextColor={palette.textSecondary}
            autoCorrect={false}
            style={[styles.input, { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
            accessibilityLabel="Word as written"
          />
          <TextInput
            value={newSpoken}
            onChangeText={setNewSpoken}
            placeholder="Say it as (e.g. Shivawn)"
            placeholderTextColor={palette.textSecondary}
            autoCorrect={false}
            style={[styles.input, { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
            accessibilityLabel="How it should sound"
          />
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={addPronunciation}
          accessibilityRole="button"
          accessibilityLabel="Save pronunciation and hear it"
        >
          <Text style={[styles.primaryBtnText, { color: palette.buttonText }]}>Save and listen</Text>
        </TouchableOpacity>
        {pronunciations.map(entry => (
          <View key={entry.id} style={[styles.pronItem, { borderBottomColor: palette.border }]}>
            <TouchableOpacity
              style={styles.pronItemMain}
              onPress={() => speak(entry.written, buildSpeechOptions(settings))}
              accessibilityRole="button"
              accessibilityLabel={`${entry.written}, said as ${entry.spoken}. Tap to listen.`}
            >
              <Text style={[styles.label, { color: palette.text }]} numberOfLines={2}>
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
              <Text style={{ color: palette.danger, fontFamily: fonts.bold, fontSize: 15 }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </SettingsSection>

      <SettingsSection palette={palette} title="Board">
        {switchRow(
          'Compact layout',
          'For small screens: hides the board header (name, situation, quick phrases) so more words fit. Settings and situations move into the page row. Off unless you turn it on.',
          settings.compactLayout === true,
          (val) => updateSettings({ compactLayout: val })
        )}
        {isSmallScreen && settings.compactLayout !== true && (
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            This screen is small. Compact layout shows more rows of words.
          </Text>
        )}
        {divider}
        {switchRow(
          'Speak each word when tapped',
          'Turn off to build the whole sentence quietly and speak it with the Speak button.',
          settings.speakWordsOnTap !== false,
          (val) => updateSettings({ speakWordsOnTap: val })
        )}
        {divider}
        {switchRow(
          'Word suggestions',
          'A row of four suggested next words above the board. Suggestions are only added when you tap them, and the row never moves the board.',
          settings.predictionEnabled !== false,
          (val) => updateSettings({ predictionEnabled: val })
        )}
      </SettingsSection>

      <SettingsSection palette={palette} title="Switch access">
        {switchRow(
          'Show switch scanning button',
          'A Scan button in the page row for switch users.',
          settings.showScanControls !== false,
          (val) => updateSettings({ showScanControls: val })
        )}
        {divider}
        <SettingsLabel palette={palette}>Scanning</SettingsLabel>
        {segmented(
          [['auto', 'Auto scan'], ['step', 'Step scan']],
          settings.scanMode || 'auto',
          (v) => updateSettings({ scanMode: v })
        )}
        <View style={styles.speedRow}>
          <TouchableOpacity
            style={[styles.speedBtn, { backgroundColor: palette.surface }]}
            onPress={() => updateSettings({ scanSpeed: Math.min(5000, (settings.scanSpeed || 1500) + 500) })}
            accessibilityRole="button"
            accessibilityLabel={`Scan slower. Currently ${((settings.scanSpeed || 1500) / 1000).toFixed(1)} seconds per item`}
          >
            <Text style={[styles.segmentText, { color: palette.text }]}>Slower</Text>
          </TouchableOpacity>
          <Text style={[styles.label, { color: palette.text }]}>
            {((settings.scanSpeed || 1500) / 1000).toFixed(1)}s
          </Text>
          <TouchableOpacity
            style={[styles.speedBtn, { backgroundColor: palette.surface }]}
            onPress={() => updateSettings({ scanSpeed: Math.max(500, (settings.scanSpeed || 1500) - 500) })}
            accessibilityRole="button"
            accessibilityLabel={`Scan faster. Currently ${((settings.scanSpeed || 1500) / 1000).toFixed(1)} seconds per item`}
          >
            <Text style={[styles.segmentText, { color: palette.text }]}>Faster</Text>
          </TouchableOpacity>
        </View>
      </SettingsSection>

      <SettingsSection palette={palette}
        title="Learning and privacy"
        note="Learned words stay on this device. They are not synced, uploaded or shared."
      >
        {switchRow(
          'Learn from my words',
          'Personal suggestions from the words you use. Only the suggestion row changes. Off unless you turn it on.',
          settings.localLearning === true,
          (val) => updateSettings({ localLearning: val })
        )}
        <TouchableOpacity
          onPress={() => navigation.navigate('Learning')}
          style={[styles.linkRow, { backgroundColor: palette.surface }]}
          accessibilityRole="button"
          accessibilityLabel="See what Voice has learned"
        >
          <Ionicons name="sparkles-outline" size={20} color={palette.primary} />
          <Text style={[styles.label, { color: palette.text, flex: 1 }]}>See what Voice has learned</Text>
          {learnedData ? <Text style={[styles.helper, { color: palette.textSecondary }]}>edit · clear</Text> : null}
          <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        {divider}
        <CloudUnavailableNotice feature="Online suggestions and cloud sync" />
        {switchRow(
          'Online suggestions',
          'Sends your current sentence and recent phrases (never your name or email) to our secure server to generate better phrase suggestions. Turn off to keep all communication on-device.',
          settings.cloudSuggestionsEnabled !== false,
          (val) => updateSettings({ cloudSuggestionsEnabled: val })
        )}
      </SettingsSection>

      <SettingsSection palette={palette} title="About">
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: palette.surface }]}
          onPress={() => navigation.navigate('Feedback')}
          accessibilityRole="button"
          accessibilityLabel="Send feedback"
        >
          <Ionicons name="chatbox-ellipses-outline" size={20} color={palette.primary} />
          <Text style={[styles.label, { color: palette.text, flex: 1 }]}>Send feedback</Text>
          <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL(brand.privacyPolicyUrl)}
          accessibilityRole="link"
          accessibilityLabel="Open privacy policy"
          style={[styles.linkRow, { backgroundColor: palette.surface }]}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={palette.primary} />
          <Text style={[styles.label, { color: palette.text, flex: 1 }]}>Privacy policy</Text>
          <Ionicons name="open-outline" size={18} color={palette.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Licenses')}
          accessibilityRole="link"
          accessibilityLabel="Credits and open-source licences"
          style={[styles.linkRow, { backgroundColor: palette.surface }]}
        >
          <Ionicons name="document-text-outline" size={20} color={palette.primary} />
          <Text style={[styles.label, { color: palette.text, flex: 1 }]}>Credits & open-source licences</Text>
          <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.helper, { color: palette.textSecondary }]}>
          Pictograms' author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain).
        </Text>
        <Text style={[styles.version, { color: palette.textSecondary }]}>
          {brand.name} v{packageJson.version}
        </Text>
      </SettingsSection>
    </ScrollView>
  );
}

// Defined outside the screen so they keep their identity between renders
// (otherwise the pronunciation text fields would remount on every keystroke).
function SettingsSection({ palette, title, children, note }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.textSecondary }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }]}>
        {children}
      </View>
      {note ? <Text style={[styles.note, { color: palette.textSecondary }]}>{note}</Text> : null}
    </View>
  );
}

function SettingsLabel({ palette, children, helper }) {
  return (
    <View style={styles.labelBlock}>
      <Text style={[styles.label, { color: palette.text }]}>{children}</Text>
      {helper ? <Text style={[styles.helper, { color: palette.textSecondary }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  center: { justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 30, marginTop: spacing.xs },
  subheading: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, marginTop: 4, marginBottom: spacing.sm },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  note: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginTop: spacing.sm, marginLeft: spacing.xs },
  labelBlock: { gap: 2 },
  label: { fontSize: 17, fontFamily: fonts.bold },
  helper: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  segment: { flexDirection: 'row', borderRadius: radii.lg, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { fontSize: 15, fontFamily: fonts.bold },
  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeCard: { flex: 1, padding: spacing.md, borderWidth: 2, minHeight: 140 },
  modeEmoji: { fontSize: 34 },
  modeTitle: { fontSize: 22, marginTop: spacing.xs },
  modeBlurb: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 19, marginTop: 4 },
  modeTick: {
    position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerContainer: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  primaryBtn: {
    flexDirection: 'row', gap: 8, minHeight: 52, borderRadius: radii.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 17, fontFamily: fonts.bold },
  pronRow: { gap: spacing.sm },
  input: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, minHeight: 50,
    fontSize: 16, fontFamily: fonts.regular,
  },
  pronItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  pronItemMain: { flex: 1, minHeight: 48, justifyContent: 'center' },
  pronRemove: { minWidth: 72, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  speedBtn: { flex: 1, minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56,
    borderRadius: radii.lg, paddingHorizontal: spacing.md,
  },
  version: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center' },
});
