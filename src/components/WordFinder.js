// src/components/WordFinder.js
// "Find a word" — search every vocabulary page from the AAC Board.
//
// Each result shows which page the word lives on. Users can add the word
// straight to their sentence, or jump to its page to learn where it is, so
// search supports (rather than replaces) the learned motor plan.
// Nothing is spoken or added until the user taps a result.

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchVocabulary } from '../data/coreVocabulary';
import { getPalette, radii, spacing } from '../theme';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n/strings';
import { closeUnlessTyping } from '../services/keyboardBack';

export default function WordFinder({ visible, onClose, onAddWord, onShowPage, onNoResults }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme, settings.boardLayout);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const results = useMemo(() => searchVocabulary(query), [query]);
  const trimmed = query.trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={closeUnlessTyping(onClose)}
      accessibilityViewIsModal
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <View style={[styles.panel, { backgroundColor: palette.cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
              {t('findWordLabel')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.iconBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Ionicons name="close" size={24} color={palette.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('findWordPlaceholder')}
            placeholderTextColor={palette.textSecondary}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => { if (trimmed && results.length === 0) onNoResults?.(trimmed); }}
            style={[styles.input, { color: palette.text, backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
            accessibilityLabel={t('findWordPlaceholder')}
          />

          {trimmed !== '' && results.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textSecondary }]} accessibilityLiveRegion="polite">
              {t('findWordNoResults')}
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(r) => `${r.pageId}-${r.button.id}`}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.row, { borderBottomColor: palette.border }]}>
                  <TouchableOpacity
                    style={[styles.wordBtn, { backgroundColor: item.button.color || palette.surface }]}
                    onPress={() => onAddWord(item.button)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('findWordAdd')}: ${item.button.label}. ${item.pageLabel} page`}
                  >
                    <Text style={[styles.wordText, { color: item.button.textColor || palette.text }]}>
                      {item.button.label}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: palette.chipBg }]}
                    onPress={() => onShowPage(item.pageId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('findWordShowPage')}: ${item.pageLabel} page`}
                  >
                    <Ionicons name="navigate-outline" size={18} color={palette.text} />
                    <Text style={[styles.pageText, { color: palette.text }]} numberOfLines={1}>
                      {item.pageLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-start', padding: spacing.lg, paddingTop: 48 },
  panel: { borderRadius: radii.lg, padding: spacing.lg, maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 2, borderRadius: radii.sm, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 18 },
  list: { marginTop: spacing.sm },
  empty: { fontSize: 16, marginTop: spacing.lg, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  wordBtn: { flex: 1, minHeight: 52, borderRadius: radii.sm, justifyContent: 'center', paddingHorizontal: spacing.md },
  wordText: { fontSize: 18, fontWeight: '600' },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 52, maxWidth: 150, borderRadius: radii.sm, paddingHorizontal: spacing.md },
  pageText: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
});
