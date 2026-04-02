// src/screens/ContextPackScreen.js
// Context-aware vocabulary packs for different situations.
// Users manually select a context (home, school, meals, etc.)
// and get a curated phrase board for that situation.
// All phrases speak immediately on tap.

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView,
  Modal, TextInput, Alert, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { speak } from '../services/speechService';
import { getAllContextPacks, getContextPack } from '../data/contextPacks';
import { getAllQuickPageTemplates } from '../data/quickPageTemplates';
import { StatusBar } from 'expo-status-bar';
import { t } from '../i18n/strings';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import {
  loadCustomQuickPages, getCustomQuickPages,
  saveCustomQuickPage, deleteCustomQuickPage,
} from '../services/customQuickPageStore';

const CUSTOM_PAGE_COLORS = [
  '#2979FF', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0',
  '#00BCD4', '#607D8B', '#FF5722', '#795548', '#3F51B5',
];

const CATEGORY_COLORS = {
  request: '#2979FF',
  urgent: '#F44336',
  feeling: '#9C27B0',
  social: '#4CAF50',
  repair: '#FF9800',
  comment: '#607D8B',
  regulation: '#E91E63',
};

export default function ContextPackScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [activePackId, setActivePackId] = useState(null);
  const [activeQuickPage, setActiveQuickPage] = useState(null);
  const [showQuickPages, setShowQuickPages] = useState(false);
  const [customPages, setCustomPages] = useState([]);

  // Editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorPageId, setEditorPageId] = useState(null); // null = new, string = editing
  const [editorName, setEditorName] = useState('');
  const [editorPhrases, setEditorPhrases] = useState([]); // array of strings
  const [editorNewPhrase, setEditorNewPhrase] = useState('');

  const packs = getAllContextPacks();
  const builtInPages = getAllQuickPageTemplates();
  const activePack = activePackId ? getContextPack(activePackId) : null;
  const numColumns = settings.gridSize || 3;

  // Combine built-in + custom pages
  const allQuickPages = [...builtInPages, ...customPages];

  // Active display: quick page takes priority over context pack
  const displayPack = activeQuickPage || activePack;

  useEffect(() => {
    loadCustomQuickPages().then(setCustomPages);
  }, []);

  const speakPhrase = useCallback((phrase) => {
    speak(phrase.label, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    addSentenceToHistory(phrase.label).catch(() => {});
  }, [settings]);

  const selectQuickPage = useCallback((template) => {
    setActiveQuickPage(template);
    setActivePackId(null);
    setShowQuickPages(false);
  }, []);

  const selectPack = useCallback((packId) => {
    const isActive = packId === activePackId;
    setActivePackId(isActive ? null : packId);
    setActiveQuickPage(null);
    setShowQuickPages(false);
  }, [activePackId]);

  // ── Editor helpers ──

  const openNewPageEditor = useCallback(() => {
    setEditorPageId(null);
    setEditorName('');
    setEditorPhrases([]);
    setEditorNewPhrase('');
    setEditorVisible(true);
  }, []);

  const openEditPage = useCallback((page) => {
    setEditorPageId(page.id);
    setEditorName(page.label);
    setEditorPhrases(page.phrases.map(p => p.label));
    setEditorNewPhrase('');
    setEditorVisible(true);
  }, []);

  const openDuplicate = useCallback((page) => {
    setEditorPageId(null);
    setEditorName(`${page.label} (copy)`);
    setEditorPhrases(page.phrases.map(p => p.label));
    setEditorNewPhrase('');
    setEditorVisible(true);
  }, []);

  const handleLongPressPage = useCallback((page) => {
    const isCustom = customPages.some(p => p.id === page.id);
    const buttons = [{ text: 'Cancel', style: 'cancel' }];
    buttons.push({
      text: 'Duplicate as custom page',
      onPress: () => openDuplicate(page),
    });
    if (isCustom) {
      buttons.push({
        text: 'Edit',
        onPress: () => openEditPage(page),
      });
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete page?', `Remove "${page.label}" permanently?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive',
              onPress: async () => {
                await deleteCustomQuickPage(page.id);
                setCustomPages([...getCustomQuickPages()]);
                if (activeQuickPage?.id === page.id) setActiveQuickPage(null);
              },
            },
          ]);
        },
      });
    }
    Alert.alert(page.label, isCustom ? 'Edit, duplicate, or delete this page' : 'Duplicate this page as a custom page', buttons);
  }, [customPages, activeQuickPage, openEditPage, openDuplicate]);

  const addPhraseToEditor = useCallback(() => {
    const trimmed = editorNewPhrase.trim();
    if (!trimmed || editorPhrases.length >= 12) return;
    if (editorPhrases.includes(trimmed)) return;
    setEditorPhrases(prev => [...prev, trimmed]);
    setEditorNewPhrase('');
  }, [editorNewPhrase, editorPhrases]);

  const removePhraseFromEditor = useCallback((idx) => {
    setEditorPhrases(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const saveEditorPage = useCallback(async () => {
    const name = editorName.trim();
    if (!name) { Alert.alert('Name required', 'Give your page a name.'); return; }
    if (editorPhrases.length === 0) { Alert.alert('Add phrases', 'Add at least one phrase.'); return; }

    const pageId = editorPageId || `custom_${Date.now()}`;
    const colorIdx = customPages.length % CUSTOM_PAGE_COLORS.length;
    const existing = customPages.find(p => p.id === pageId);

    const page = {
      id: pageId,
      label: name,
      icon: 'create-outline',
      color: existing?.color || CUSTOM_PAGE_COLORS[colorIdx],
      isCustom: true,
      phrases: editorPhrases.map((text, i) => ({
        id: `${pageId}_p${i}`,
        label: text,
        category: 'request',
      })),
    };

    await saveCustomQuickPage(page);
    setCustomPages([...getCustomQuickPages()]);
    setEditorVisible(false);
    setActiveQuickPage(page);
    setActivePackId(null);
    setShowQuickPages(false);
  }, [editorPageId, editorName, editorPhrases, customPages]);

  const renderPackSelector = ({ item }) => {
    const isActive = item.id === activePackId && !activeQuickPage;
    return (
      <TouchableOpacity
        style={[
          styles.packCard,
          { backgroundColor: isActive ? item.color : palette.cardBg, borderColor: item.color },
        ]}
        onPress={() => selectPack(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.label} ${t('contextPack')}`}
        accessibilityState={{ selected: isActive }}
      >
        <Ionicons
          name={item.icon}
          size={24}
          color={isActive ? '#FFFFFF' : item.color}
        />
        <Text
          style={[styles.packLabel, { color: isActive ? '#FFFFFF' : palette.text }]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPhrase = ({ item }) => {
    const catColor = CATEGORY_COLORS[item.category] || palette.primary;
    return (
      <TouchableOpacity
        style={[styles.phraseBtn, { backgroundColor: catColor, flex: 1 / numColumns }]}
        onPress={() => speakPhrase(item)}
        accessibilityRole="button"
        accessibilityLabel={`Say: ${item.label}`}
        accessibilityHint="Speaks this phrase immediately"
        activeOpacity={0.7}
      >
        <Text style={styles.phraseText} numberOfLines={3} adjustsFontSizeToFit>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Pack selector row + Quick Pages button */}
      <View style={styles.selectorRow}>
        <FlatList
          data={packs}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={renderPackSelector}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.packList}
          style={{ flexGrow: 0, flexShrink: 1 }}
          ListHeaderComponent={
            <TouchableOpacity
              style={[
                styles.packCard,
                {
                  backgroundColor: showQuickPages || activeQuickPage ? '#FF6D00' : palette.cardBg,
                  borderColor: '#FF6D00',
                },
              ]}
              onPress={() => { setShowQuickPages(prev => !prev); }}
              accessibilityRole="button"
              accessibilityLabel="Quick pages for specific situations"
            >
              <Ionicons
                name="flash-outline"
                size={24}
                color={showQuickPages || activeQuickPage ? '#FFFFFF' : '#FF6D00'}
              />
              <Text
                style={[styles.packLabel, { color: showQuickPages || activeQuickPage ? '#FFFFFF' : palette.text }]}
                numberOfLines={1}
              >
                Quick
              </Text>
            </TouchableOpacity>
          }
        />
      </View>

      {/* Quick page template picker */}
      {showQuickPages && (
        <View style={[styles.quickPageGrid, { backgroundColor: palette.surface }]}>
          <Text style={[styles.quickPageTitle, { color: palette.textSecondary }]}>
            Pick a situation — or create your own:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPageRow}>
            {/* Create new button */}
            <TouchableOpacity
              style={[styles.quickPageCard, { backgroundColor: palette.cardBg, borderColor: palette.primary, borderStyle: 'dashed' }]}
              onPress={openNewPageEditor}
              accessibilityRole="button"
              accessibilityLabel="Create a new custom page"
            >
              <Ionicons name="add-circle-outline" size={22} color={palette.primary} />
              <Text style={[styles.quickPageLabel, { color: palette.primary }]} numberOfLines={1}>
                New page
              </Text>
            </TouchableOpacity>
            {allQuickPages.map(tp => {
              const isActive = activeQuickPage?.id === tp.id;
              return (
                <TouchableOpacity
                  key={tp.id}
                  style={[styles.quickPageCard, { backgroundColor: isActive ? tp.color : palette.cardBg, borderColor: tp.color }]}
                  onPress={() => selectQuickPage(tp)}
                  onLongPress={() => handleLongPressPage(tp)}
                  delayLongPress={500}
                  accessibilityRole="button"
                  accessibilityLabel={`${tp.label} quick page${tp.isCustom ? ' (custom)' : ''}. Long press to edit.`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons name={tp.icon} size={22} color={isActive ? '#FFF' : tp.color} />
                  <Text style={[styles.quickPageLabel, { color: isActive ? '#FFF' : palette.text }]} numberOfLines={1}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Active quick page banner */}
      {activeQuickPage && !showQuickPages && (
        <View style={[styles.quickBanner, { backgroundColor: activeQuickPage.color }]}>
          <Ionicons name={activeQuickPage.icon} size={16} color="#FFF" />
          <Text style={styles.quickBannerText}>{activeQuickPage.label}</Text>
          {activeQuickPage.isCustom && (
            <TouchableOpacity
              onPress={() => openEditPage(activeQuickPage)}
              accessibilityRole="button"
              accessibilityLabel="Edit this page"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setActiveQuickPage(null)}
            accessibilityRole="button"
            accessibilityLabel="Close quick page"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      )}

      {/* Active phrases (pack or quick page) */}
      {displayPack ? (
        <FlatList
          data={displayPack.phrases}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`ctx-${numColumns}-${displayPack.id}`}
          renderItem={renderPhrase}
          contentContainerStyle={styles.phraseGrid}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="apps-outline" size={48} color={palette.textSecondary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('chooseContext')}</Text>
          <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
            {t('chooseContextHint')}
          </Text>
        </View>
      )}

      {/* Custom page editor modal */}
      <Modal visible={editorVisible} animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={[styles.editorContainer, { backgroundColor: palette.background }]}>
          <View style={styles.editorHeader}>
            <Text style={[styles.editorTitle, { color: palette.text }]}>
              {editorPageId ? 'Edit Page' : 'New Quick Page'}
            </Text>
            <TouchableOpacity
              onPress={() => setEditorVisible(false)}
              style={[styles.editorCloseBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.editorScroll} keyboardShouldPersistTaps="handled">
            {/* Page name */}
            <Text style={[styles.editorLabel, { color: palette.textSecondary }]}>Page name</Text>
            <TextInput
              style={[styles.editorInput, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.text }]}
              value={editorName}
              onChangeText={setEditorName}
              placeholder="e.g. Dentist, Cinema, Park"
              placeholderTextColor={palette.textSecondary}
              maxLength={30}
              accessibilityLabel="Page name"
            />

            {/* Phrases */}
            <Text style={[styles.editorLabel, { color: palette.textSecondary }]}>
              Phrases ({editorPhrases.length}/12)
            </Text>

            {editorPhrases.map((phrase, idx) => (
              <View key={idx} style={[styles.editorPhraseRow, { backgroundColor: palette.cardBg }]}>
                <Text style={[styles.editorPhraseText, { color: palette.text }]} numberOfLines={2}>{phrase}</Text>
                <TouchableOpacity
                  onPress={() => removePhraseFromEditor(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove: ${phrase}`}
                >
                  <Ionicons name="close-circle" size={22} color={palette.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {editorPhrases.length < 12 && (
              <View style={styles.editorAddRow}>
                <TextInput
                  style={[styles.editorInput, styles.editorAddInput, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.text }]}
                  value={editorNewPhrase}
                  onChangeText={setEditorNewPhrase}
                  placeholder="Type a phrase and tap +"
                  placeholderTextColor={palette.textSecondary}
                  maxLength={80}
                  onSubmitEditing={addPhraseToEditor}
                  returnKeyType="done"
                  accessibilityLabel="New phrase"
                />
                <TouchableOpacity
                  onPress={addPhraseToEditor}
                  style={[styles.editorAddBtn, { backgroundColor: palette.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Add phrase"
                >
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.editorSaveBtn, { backgroundColor: palette.primary }]}
            onPress={saveEditorPage}
            accessibilityRole="button"
            accessibilityLabel="Save page"
          >
            <Ionicons name="checkmark" size={20} color="#FFF" />
            <Text style={styles.editorSaveBtnText}>
              {editorPageId ? 'Save changes' : 'Create page'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  selectorRow: { flexGrow: 0, maxHeight: 90 },
  packList: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  packCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    marginRight: spacing.sm,
    minWidth: 80,
    gap: 4,
  },
  packLabel: { fontSize: 12, fontWeight: '600' },
  phraseGrid: { padding: spacing.xs, paddingBottom: 80 },
  phraseBtn: {
    margin: 3,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptySubtitle: { fontSize: 15, textAlign: 'center' },
  // Quick page styles
  quickPageGrid: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  quickPageTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  quickPageRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  quickPageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    minWidth: 90,
    gap: 4,
  },
  quickPageLabel: { fontSize: 12, fontWeight: '600' },
  quickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  quickBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Editor modal styles
  editorContainer: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  editorTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  editorCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorScroll: {
    paddingBottom: 20,
  },
  editorLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editorInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  editorPhraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  editorPhraseText: {
    flex: 1,
    fontSize: 15,
    marginRight: spacing.sm,
  },
  editorAddRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editorAddInput: {
    flex: 1,
  },
  editorAddBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    marginBottom: 30,
    gap: spacing.xs,
  },
  editorSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
