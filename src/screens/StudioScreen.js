// src/screens/StudioScreen.js
// Personalise: one place for how Voice looks and what it knows.
// - Look: mode, board layout, symbols, text size, grid, controls position, theme
// - Picture symbols: optional download (ARASAAC), remove any time
// - My words: create a tile with an optional photo, preview before saving
// - Learning: off until enabled; plain-language explanation, reset
// - Protect: optional lock against accidental changes (never locks the board)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet, Alert, Pressable, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { MODE_DESCRIPTIONS } from '../contexts/experience';
import { usePaper } from '../design/usePaper';
import { Card, Segmented, SwitchRow, ActionButton, Tile, ListRow, Notice } from '../design/components';
import { space, type, touch } from '../design/tokens';
import ModeSheet from '../components/studio/ModeSheet';
import {
  getSymbolState, subscribeSymbols, loadSymbolState, downloadSymbols, deleteSymbols, symbolCount,
} from '../services/symbolStore';
import {
  loadCustomVocab, getCustomVocab, addCustomVocabItem, removeCustomVocabItem,
} from '../services/customVocabStore';
import { saveTilePhoto, removeTilePhoto, getTilePhoto } from '../services/tilePhotoStore';
import { searchVocabulary } from '../data/coreVocabulary';
import { getLearningStats, resetLearning, setLearningEnabled } from '../services/suggestionEngine';

const CATEGORIES = [
  { value: 'noun', label: 'Thing' },
  { value: 'verb', label: 'Action' },
  { value: 'adjective', label: 'Detail' },
  { value: 'social', label: 'Social' },
  { value: 'pronoun', label: 'Person' },
];

/** Suggest a category for a new word from the board vocabulary (local). */
export function suggestCategory(word) {
  const w = (word || '').trim().toLowerCase();
  if (!w) return null;
  const hit = searchVocabulary(w, 5).find((r) => r.button.label.toLowerCase() === w);
  return hit ? hit.button.category : null;
}

export default function StudioScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings } = useSettings();
  const p = usePaper();
  const { c, r } = p;
  const [modeOpen, setModeOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const locked = settings.editLock === true && !unlocked;
  // Unlocking lasts only while this screen is open.
  useFocusEffect(useCallback(() => () => setUnlocked(false), []));

  // ── Symbols ──
  const [sym, setSym] = useState(getSymbolState());
  const [progress, setProgress] = useState(null);
  useEffect(() => { loadSymbolState().catch(() => {}); return subscribeSymbols(setSym); }, []);
  const startDownload = async () => {
    setProgress({ done: 0, total: symbolCount() });
    const res = await downloadSymbols((done, total) => setProgress({ done, total }));
    setProgress(null);
    if (res.failed > 0) Alert.alert('Some symbols could not download', `${res.failed} symbols are missing. Check your connection and try again; the words still work.`);
  };

  // ── My words ──
  const [words, setWords] = useState([]);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState('noun');
  const [photo, setPhoto] = useState(null);
  const [photoNote, setPhotoNote] = useState(null);
  const refreshWords = useCallback(async () => { await loadCustomVocab(); setWords([...getCustomVocab()]); }, []);
  useEffect(() => { refreshWords(); }, [refreshWords]);
  const suggested = useMemo(() => suggestCategory(draft), [draft]);
  useEffect(() => { if (suggested && CATEGORIES.some((x) => x.value === suggested)) setCategory(suggested); }, [suggested]);

  const pick = async (fromCamera) => {
    setPhotoNote(null);
    try {
      // Only the camera needs a permission. The system photo picker does not
      // (and on Android 12 and lower the storage permission is removed from
      // this app, so asking for it would always be refused).
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPhotoNote('Camera permission was not given. You can still make the tile without a photo, or allow the camera in system settings.');
          return;
        }
      }
      const opts = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
      const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets && res.assets[0]) setPhoto(res.assets[0].uri);
    } catch {
      setPhotoNote('The photo could not be opened. Try another one, or save the tile without a photo.');
    }
  };

  const saveWord = async () => {
    const entry = await addCustomVocabItem(draft, category, 'manual');
    if (!entry) {
      Alert.alert('Word not added', 'That word is empty or already on your board.');
      return;
    }
    if (photo) await saveTilePhoto(entry.id, photo).catch(() => setPhotoNote('The tile was saved without its photo.'));
    setDraft(''); setPhoto(null);
    refreshWords();
  };

  const removeWord = (item) => {
    Alert.alert('Remove word', `Remove “${item.word}” from your board?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeCustomVocabItem(item.id); await removeTilePhoto(item.id); refreshWords(); } },
    ]);
  };

  // ── Learning ──
  const [stats, setStats] = useState(getLearningStats());
  useEffect(() => { setStats(getLearningStats()); }, [settings.personalLearning]);
  const toggleLearning = (on) => {
    updateSettings({ personalLearning: on });
    setLearningEnabled(on);
  };
  const confirmReset = () => {
    Alert.alert('Delete what Voice has learned?', 'Suggestions go back to the starting set. Your words, favourites and history are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await resetLearning(); setStats(getLearningStats()); } },
    ]);
  };

  const mode = settings.uiMode === 'child' ? 'child' : 'adult';
  const previewButton = { id: 'preview', label: draft.trim() || 'your word', category, imageUri: photo || undefined };

  const segment = (label, key, options, help) => (
    <View style={styles.block}>
      <Text style={[type.heading, { color: c.ink, fontSize: 16, marginBottom: 6 }]}>{label}</Text>
      <Segmented label={label} value={settings[key]} options={options} onChange={(v) => updateSettings({ [key]: v })} />
      {help ? <Text style={[type.body, { color: c.inkSoft, marginTop: 4 }]}>{help}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={styles.content}>
      {settings.editLock === true && (
        <Notice
          icon={locked ? 'lock-closed-outline' : 'lock-open-outline'}
          action={locked ? (
            <Pressable
              onLongPress={() => setUnlocked(true)}
              delayLongPress={1500}
              accessibilityRole="button"
              accessibilityLabel="Unlock editing. Press and hold."
              style={[styles.unlock, { backgroundColor: c.card, borderRadius: r.control }]}
            >
              <Text style={[type.label, { color: c.ink }]}>Hold to unlock</Text>
            </Pressable>
          ) : null}
        >
          {locked ? 'Personalisation is protected. The board, speech and phrases always work.' : 'Unlocked until you leave this screen.'}
        </Notice>
      )}

      <View pointerEvents={locked ? 'none' : 'auto'} style={{ opacity: locked ? 0.45 : 1 }} accessibilityElementsHidden={locked} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}>
        <Card title="Mode and look">
          <View style={styles.modeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: c.ink }]}>{MODE_DESCRIPTIONS[mode].title} mode</Text>
              <Text style={[type.body, { color: c.inkSoft }]}>{MODE_DESCRIPTIONS[mode].summary}</Text>
            </View>
            <ActionButton label="Change" onPress={() => setModeOpen(true)} size={touch.min} a11yLabel="Change mode" />
          </View>
          <Text style={[type.body, { color: c.inkSoft, marginTop: space.sm }]}>The settings below are saved for {MODE_DESCRIPTIONS[mode].title} mode only. They never move a word.</Text>
          {segment('Pictures on tiles', 'symbolStyle', [
            { value: 'symbols', label: 'Large' }, { value: 'mixed', label: 'Small' }, { value: 'text', label: 'Words only' },
          ], sym.downloaded ? null : 'Built-in pictures show now. Download picture symbols below for more detailed ones.')}
          {segment('Colours', 'theme', [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'highContrast', label: 'High contrast' }])}
          <SwitchRow label="Speak each word" description="Say a word aloud as you add it." value={settings.speakWordsOnTap !== false} onValueChange={(v) => updateSettings({ speakWordsOnTap: v })} />
          <SwitchRow label="Show suggestions" description="A row of suggested next words. They are never added for you." value={settings.predictionEnabled !== false} onValueChange={(v) => updateSettings({ predictionEnabled: v })} />
        </Card>

        <Card title="Board layout" caption="Shared by both modes, so a word is in the same place in Child and Adult.">
          {segment('Text size', 'textScale', [{ value: 1, label: 'Standard' }, { value: 1.25, label: 'Large' }, { value: 1.5, label: 'Extra large' }])}
          {segment('Words per row', 'gridSize', [{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }], 'Changing this moves words to new places. Change it rarely.')}
          {segment('Layout', 'boardLayout', [{ value: 'studio', label: 'New' }, { value: 'classic', label: 'Classic' }], 'Classic is the familiar board from earlier versions. Your words and messages are the same in both.')}
          {segment('Message and controls', 'controlsPosition', [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom (one hand)' }])}
        </Card>

        <Card title="Picture symbols" caption={`ARASAAC pictograms for ${symbolCount()} board words. Downloaded once to this phone (about 1 MB), then they work offline. Nothing about you is sent.`}>
          {progress ? (
            <Text style={[type.body, { color: c.ink }]} accessibilityLiveRegion="polite">Downloading {progress.done} of {progress.total}…</Text>
          ) : sym.downloaded ? (
            <ActionButton icon="trash-outline" label="Remove downloaded symbols" onPress={() => deleteSymbols()} size={touch.min} />
          ) : (
            <ActionButton icon="download-outline" label="Download symbols" variant="signal" onPress={startDownload} size={touch.min} />
          )}
          <Text style={[type.caption, { color: c.inkSoft, marginTop: space.sm, letterSpacing: 0 }]}>
            Pictograms by Sergio Palao. Origin: ARASAAC (arasaac.org). Licence: CC BY-NC-SA. Owner: Government of Aragón.
          </Text>
          <ListRow icon="document-text-outline" text="Credits and licences" onPress={() => navigation.navigate('Licenses')} />
        </Card>

        <Card title="My words" caption="Add a word tile. It appears at the end of the Home page, so other words never move.">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a word or name, e.g. Grandma"
            placeholderTextColor={c.inkSoft}
            style={[styles.input, { color: c.ink, borderColor: c.lineStrong, backgroundColor: c.sunk, borderRadius: r.control }]}
            accessibilityLabel="New word"
            maxLength={40}
          />
          <Text style={[type.heading, { color: c.ink, fontSize: 16, marginTop: space.md, marginBottom: 6 }]}>Kind of word</Text>
          <Segmented label="Kind of word" value={category} onChange={setCategory} options={CATEGORIES} />
          {suggested ? <Text style={[type.body, { color: c.inkSoft, marginTop: 4 }]}>Suggested from your board: {CATEGORIES.find((x) => x.value === suggested)?.label || suggested}. Change it if it is wrong.</Text> : null}
          <View style={styles.photoRow}>
            {Platform.OS !== 'web' && <ActionButton icon="camera-outline" label="Take photo" onPress={() => pick(true)} size={touch.min} flex={1} />}
            <ActionButton icon="images-outline" label="Choose photo" onPress={() => pick(false)} size={touch.min} flex={1} />
          </View>
          {photo ? <ActionButton icon="close" label="Remove photo" variant="ghost" onPress={() => setPhoto(null)} size={touch.min} /> : null}
          {photoNote ? <Notice tone="warning">{photoNote}</Notice> : null}
          <Text style={[type.caption, { color: c.inkSoft, marginTop: space.md }]}>PREVIEW</Text>
          <View style={styles.preview}>
            <Tile button={previewButton} height={110} symbolStyle={photo ? 'symbols' : 'text'} symbolSource={photo ? { uri: photo } : null} accessibilityLabel={`Preview tile: ${previewButton.label}`} />
            <View style={{ flex: 1 }} />
          </View>
          <Text style={[type.caption, { color: c.inkSoft, letterSpacing: 0 }]}>Photos stay on this phone. They are never uploaded or synced.</Text>
          <ActionButton label="Save tile" icon="checkmark" variant="signal" onPress={saveWord} disabled={!draft.trim()} size={touch.action} style={{ marginTop: space.md }} />
          {words.length > 0 && (
            <View style={{ marginTop: space.md }}>
              {words.map((w) => (
                <ListRow
                  key={w.id} icon={getTilePhoto(w.id) ? 'image-outline' : 'text-outline'} text={w.word}
                  meta={(CATEGORIES.find((x) => x.value === w.category) || {}).label}
                  onPress={() => removeWord(w)} a11yLabel={`${w.word}. Remove`}
                />
              ))}
            </View>
          )}
        </Card>

        <Card title="Learning">
          <SwitchRow
            label="Learn from my messages"
            description="Off until you turn it on. When on, Voice counts which words you use together in messages you speak, on this phone only, to improve suggestions."
            value={settings.personalLearning === true}
            onValueChange={toggleLearning}
          />
          <Text style={[type.body, { color: c.inkSoft }]}>
            {settings.personalLearning === true ? 'Learning is on.' : 'Learning is paused.'} Learned so far: {stats.sentences} messages, {stats.pairs} word pairs.
          </Text>
          <Text style={[type.body, { color: c.inkSoft, marginTop: space.sm }]}>
            What is kept: word counts and word pairs from spoken messages. Not kept: taps you delete, modelling sessions, or anything when learning is off. Long-press a suggestion on the board to stop it appearing.
          </Text>
          <ListRow icon="sparkles-outline" text="See what Voice has learned" meta="forget words, undo hidden suggestions" onPress={() => navigation.navigate('Learned')} />
          <ActionButton icon="trash-outline" label="Delete what Voice has learned" variant="danger" onPress={confirmReset} size={touch.min} style={{ marginTop: space.md }} />
        </Card>

        <Card title="Protect personalisation">
          <SwitchRow
            label="Lock this screen"
            description="Needs a press-and-hold to change these settings. Never locks the board, speech, phrases or saying no."
            value={settings.editLock === true}
            onValueChange={(v) => updateSettings({ editLock: v })}
          />
        </Card>

        <Card title="More">
          <ListRow icon="settings-outline" text="All settings (voice, speech, scanning)" onPress={() => navigation.navigate('Settings')} />
          <ListRow icon="text-outline" text="Sentence builder" onPress={() => navigation.navigate('Sentence')} />
          <ListRow icon="happy-outline" text="Feelings" onPress={() => navigation.navigate('Emotion')} />
        </Card>
      </View>
      <ModeSheet visible={modeOpen} onClose={() => setModeOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 48 },
  block: { marginTop: space.md },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: { minHeight: touch.min, borderWidth: 1.5, paddingHorizontal: space.md, fontSize: 17 },
  photoRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  preview: { flexDirection: 'row', width: '100%', maxWidth: 360, marginVertical: space.sm },
  unlock: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.md },
});
