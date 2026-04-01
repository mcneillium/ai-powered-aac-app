// src/screens/VocabManagerScreen.js
// Caregiver screen for reviewing vocabulary requests and managing custom words.
// Restricted to caregiver role. Guest and regular users see a permission message.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getPalette, spacing, radii, shadows } from '../theme';
import {
  loadCustomVocab, getCustomVocab, addCustomVocabItem,
  removeCustomVocabItem, updateCustomVocabItem,
  getVocabRequests, dismissVocabRequest, refreshFromFirebase,
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
  const { user, role } = useAuth();
  const palette = getPalette(settings.theme);
  const [requests, setRequests] = useState({});
  const [vocab, setVocab] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('noun');
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editWord, setEditWord] = useState('');
  const [editCategory, setEditCategory] = useState('noun');

  const load = useCallback(async () => {
    await loadCustomVocab();
    setVocab([...getCustomVocab()]);
    setRequests(await getVocabRequests());
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFromFirebase();
    setVocab([...getCustomVocab()]);
    setRequests(await getVocabRequests());
    setRefreshing(false);
  };

  // ── Role gate ──
  if (!user || role !== 'caregiver') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: palette.background }]}>
        <Ionicons name="lock-closed-outline" size={48} color={palette.textSecondary} />
        <Text style={[styles.gateTitle, { color: palette.text }]}>Caregiver access only</Text>
        <Text style={[styles.gateHint, { color: palette.textSecondary }]}>
          {!user
            ? 'Sign in with a caregiver account to manage vocabulary.'
            : 'This screen is for caregivers. Your account is registered as a regular user. To change your role, contact support.'}
        </Text>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

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
    Alert.alert('Dismiss request', `Remove "${term}" from the request list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss', style: 'destructive',
        onPress: async () => { await dismissVocabRequest(term); await load(); },
      },
    ]);
  };

  const handleAddManual = async () => {
    const trimmed = newWord.trim();
    if (!trimmed) { Alert.alert('Enter a word', 'Type a word or short phrase to add.'); return; }
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
    Alert.alert('Remove word', `Remove "${item.word}" from custom vocabulary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await removeCustomVocabItem(item.id); await load(); },
      },
    ]);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditWord(item.word);
    setEditCategory(item.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditWord('');
  };

  const saveEdit = async () => {
    if (!editWord.trim()) { Alert.alert('Enter a word'); return; }
    const result = await updateCustomVocabItem(editingId, {
      word: editWord,
      category: editCategory,
    });
    if (result) {
      setEditingId(null);
      setEditWord('');
      await load();
    } else {
      Alert.alert('Error', 'Could not update. The word may already exist.');
    }
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
            {requestList.map(([term]) => (
              <View key={term} style={[styles.requestRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.requestWord, { color: palette.text }]}>{term}</Text>
                <TouchableOpacity
                  onPress={() => handleApprove(term)}
                  style={[styles.actionChip, { backgroundColor: palette.success }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Approve "${term}"`}
                >
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={styles.actionChipText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDismiss(term)}
                  style={[styles.actionChip, { backgroundColor: palette.chipBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss "${term}"`}
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
              style={[styles.catChip, { backgroundColor: newCategory === cat.id ? palette.primary : palette.chipBg }]}
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
              These words appear on the AAC Board. Tap to edit, X to remove.
            </Text>
            {vocab.map(item => (
              <View key={item.id}>
                {editingId === item.id ? (
                  /* ── Edit mode ── */
                  <View style={[styles.editRow, { borderBottomColor: palette.border }]}>
                    <TextInput
                      style={[styles.editInput, { borderColor: palette.inputBorder, color: palette.text, backgroundColor: palette.inputBg }]}
                      value={editWord}
                      onChangeText={setEditWord}
                      autoCapitalize="none"
                      autoFocus
                      accessibilityLabel="Edit word"
                    />
                    <View style={styles.editCategories}>
                      {CATEGORIES.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.catChipSmall, { backgroundColor: editCategory === cat.id ? palette.primary : palette.chipBg }]}
                          onPress={() => setEditCategory(cat.id)}
                        >
                          <Text style={[styles.catChipSmallText, { color: editCategory === cat.id ? palette.buttonText : palette.text }]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.editActions}>
                      <TouchableOpacity onPress={saveEdit} style={[styles.actionChip, { backgroundColor: palette.success }]}
                        accessibilityRole="button" accessibilityLabel="Save changes">
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                        <Text style={styles.actionChipText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={cancelEdit} style={[styles.actionChip, { backgroundColor: palette.chipBg }]}
                        accessibilityRole="button" accessibilityLabel="Cancel editing">
                        <Text style={[styles.actionChipText, { color: palette.text }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── Display mode ── */
                  <View style={[styles.vocabRow, { borderBottomColor: palette.border }]}>
                    <TouchableOpacity style={styles.vocabInfo} onPress={() => startEdit(item)}
                      accessibilityRole="button" accessibilityLabel={`Edit "${item.word}"`}>
                      <Text style={[styles.vocabWord, { color: palette.text }]}>{item.word}</Text>
                      <Text style={[styles.vocabMeta, { color: palette.textSecondary }]}>
                        {item.category} · {item.source}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(item)} style={styles.removeBtn}
                      accessibilityRole="button" accessibilityLabel={`Remove "${item.word}"`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={22} color={palette.danger} />
                    </TouchableOpacity>
                  </View>
                )}
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
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  gateTitle: { fontSize: 20, fontWeight: '600', marginTop: spacing.lg },
  gateHint: { fontSize: 15, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22, maxWidth: 300 },
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
  editRow: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  editInput: {
    height: 40, borderWidth: 1, borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, fontSize: 15, marginBottom: spacing.xs,
  },
  editCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: spacing.xs },
  catChipSmall: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  catChipSmallText: { fontSize: 11, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
