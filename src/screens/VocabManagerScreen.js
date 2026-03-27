// src/screens/VocabManagerScreen.js
// Caregiver screen for reviewing vocabulary requests and managing custom words.
// Requested words come from InsightsScreen. Approved words appear on the AAC Board.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii, shadows } from '../theme';
import {
  loadCustomVocab, getCustomVocab, addCustomVocabItem,
  removeCustomVocabItem, getVocabRequests, dismissVocabRequest,
} from '../services/customVocabStore';
import { StatusBar } from 'expo-status-bar';

const CATEGORIES = [
  { id: 'noun', label: 'Noun', example: 'cat, shoe, ball' },
  { id: 'verb', label: 'Verb', example: 'run, eat, play' },
  { id: 'adjective', label: 'Adjective', example: 'big, cold, happy' },
  { id: 'social', label: 'Social', example: 'hello, thanks, sorry' },
  { id: 'important', label: 'Important', example: 'stop, help, pain' },
  { id: 'misc', label: 'Other', example: 'the, more, here' },
];

export default function VocabManagerScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [requests, setRequests] = useState({});
  const [vocab, setVocab] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('noun');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await loadCustomVocab();
    setVocab([...getCustomVocab()]);
    setRequests(await getVocabRequests());
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleApprove = async (term) => {
    Alert.alert(
      'Add to vocabulary',
      `Add "${term}" as a word the user can tap on the AAC Board?\n\nChoose a category:`,
      CATEGORIES.map(cat => ({
        text: `${cat.label} (${cat.example})`,
        onPress: async () => {
          const result = await addCustomVocabItem(term, cat.id, 'requested');
          if (result) {
            await dismissVocabRequest(term);
            await load();
          } else {
            Alert.alert('Already exists', `"${term}" is already in the vocabulary.`);
          }
        },
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const handleDismiss = async (term) => {
    Alert.alert(
      'Dismiss request',
      `Remove "${term}" from the request list? This won't delete the word if it's already been added.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            await dismissVocabRequest(term);
            await load();
          },
        },
      ]
    );
  };

  const handleAddManual = async () => {
    const trimmed = newWord.trim();
    if (!trimmed) {
      Alert.alert('Enter a word', 'Type a word or short phrase to add.');
      return;
    }
    const result = await addCustomVocabItem(trimmed, newCategory, 'manual');
    if (result) {
      setNewWord('');
      await load();
      Alert.alert('Added', `"${trimmed}" is now available on the AAC Board home page.`);
    } else {
      Alert.alert('Already exists', `"${trimmed}" is already in the vocabulary.`);
    }
  };

  const handleRemove = (item) => {
    Alert.alert(
      'Remove word',
      `Remove "${item.word}" from custom vocabulary? The user will no longer see it on the AAC Board.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCustomVocabItem(item.id);
            await load();
          },
        },
      ]
    );
  };

  const requestList = Object.entries(requests).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── Pending requests ── */}
      <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="alert-circle-outline" size={18} color={palette.warning} />
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Vocabulary requests</Text>
        </View>
        {requestList.length === 0 ? (
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            No pending requests. When the user searches for a word that isn't in the vocabulary, it will appear here for review.
          </Text>
        ) : (
          <>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              These words were searched for but not found. Approve to add them to the AAC Board.
            </Text>
            {requestList.map(([term, timestamp]) => (
              <View key={term} style={[styles.requestRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.requestWord, { color: palette.text }]}>{term}</Text>
                <TouchableOpacity
                  onPress={() => handleApprove(term)}
                  style={[styles.actionChip, { backgroundColor: palette.success }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Approve "${term}" and add to vocabulary`}
                >
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={styles.actionChipText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDismiss(term)}
                  style={[styles.actionChip, { backgroundColor: palette.chipBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss request for "${term}"`}
                >
                  <Ionicons name="close" size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>

      {/* ── Add word manually ── */}
      <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Add a word</Text>
        </View>
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Type a word or short phrase to add to the AAC Board.
        </Text>
        <TextInput
          style={[styles.input, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
          placeholder="Word or short phrase"
          placeholderTextColor={palette.textSecondary}
          value={newWord}
          onChangeText={setNewWord}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleAddManual}
          accessibilityLabel="Enter a word to add to vocabulary"
        />
        <View style={styles.categoryRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catChip,
                { backgroundColor: newCategory === cat.id ? palette.primary : palette.chipBg },
              ]}
              onPress={() => setNewCategory(cat.id)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat.label}`}
              accessibilityState={{ selected: newCategory === cat.id }}
            >
              <Text style={[styles.catChipText, { color: newCategory === cat.id ? palette.buttonText : palette.text }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: palette.primary }]}
          onPress={handleAddManual}
          accessibilityRole="button"
          accessibilityLabel="Add word to vocabulary"
        >
          <Ionicons name="add" size={20} color={palette.buttonText} />
          <Text style={[styles.addBtnText, { color: palette.buttonText }]}>Add to vocabulary</Text>
        </TouchableOpacity>
      </View>

      {/* ── Current custom vocabulary ── */}
      <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={18} color={palette.info} />
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Custom vocabulary</Text>
          <Text style={[styles.countBadge, { color: palette.textSecondary }]}>{vocab.length}</Text>
        </View>
        {vocab.length === 0 ? (
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            No custom words yet. Add words above or approve requests. Custom words appear on the AAC Board home page.
          </Text>
        ) : (
          <>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              These words appear on the AAC Board home page. Tap the X to remove.
            </Text>
            {vocab.map(item => (
              <View key={item.id} style={[styles.vocabRow, { borderBottomColor: palette.border }]}>
                <View style={styles.vocabInfo}>
                  <Text style={[styles.vocabWord, { color: palette.text }]}>{item.word}</Text>
                  <Text style={[styles.vocabMeta, { color: palette.textSecondary }]}>
                    {item.category} · {item.source}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(item)}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove "${item.word}" from vocabulary`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color={palette.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  card: { marginHorizontal: spacing.md, marginTop: spacing.lg, borderRadius: radii.md, padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  countBadge: { fontSize: 13, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  requestRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  requestWord: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 14, gap: 3,
  },
  actionChipText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  input: {
    height: 44, borderWidth: 1, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, fontSize: 16, marginBottom: spacing.md,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  catChipText: { fontSize: 13, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: radii.sm, gap: spacing.xs,
  },
  addBtnText: { fontSize: 16, fontWeight: '600' },
  vocabRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  vocabInfo: { flex: 1 },
  vocabWord: { fontSize: 15, fontWeight: '600' },
  vocabMeta: { fontSize: 12, marginTop: 1 },
  removeBtn: { padding: 4 },
});
