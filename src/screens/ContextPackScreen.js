// src/screens/ContextPackScreen.js
// Context-aware vocabulary packs for different situations.
// Users manually select a context (home, school, meals, etc.)
// and get a curated phrase board for that situation.
// All phrases speak immediately on tap.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, radii, spacing } from '../theme';
import { speak } from '../services/speechService';
import { getAllContextPacks, getContextPack } from '../data/contextPacks';
import { StatusBar } from 'expo-status-bar';
import { t } from '../i18n/strings';

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

  const packs = getAllContextPacks();
  const activePack = activePackId ? getContextPack(activePackId) : null;
  const numColumns = settings.gridSize || 3;

  const speakPhrase = useCallback((phrase) => {
    speak(phrase.label, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  }, [settings]);

  const renderPackSelector = ({ item }) => {
    const isActive = item.id === activePackId;
    return (
      <TouchableOpacity
        style={[
          styles.packCard,
          { backgroundColor: isActive ? item.color : palette.cardBg, borderColor: item.color },
        ]}
        onPress={() => setActivePackId(isActive ? null : item.id)}
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
      {/* Pack selector */}
      <FlatList
        data={packs}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={renderPackSelector}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.packList}
        style={styles.packListContainer}
      />

      {/* Active pack phrases */}
      {activePack ? (
        <FlatList
          data={activePack.phrases}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`ctx-${numColumns}`}
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

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  packListContainer: { flexGrow: 0, maxHeight: 90 },
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
});
