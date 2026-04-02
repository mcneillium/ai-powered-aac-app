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
import { getAllQuickPageTemplates } from '../data/quickPageTemplates';
import { StatusBar } from 'expo-status-bar';
import { t } from '../i18n/strings';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';

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
  const [activeQuickPage, setActiveQuickPage] = useState(null); // template object or null
  const [showQuickPages, setShowQuickPages] = useState(false);

  const packs = getAllContextPacks();
  const quickPages = getAllQuickPageTemplates();
  const activePack = activePackId ? getContextPack(activePackId) : null;
  const numColumns = settings.gridSize || 3;

  // Active display: quick page takes priority over context pack
  const displayPack = activeQuickPage || activePack;

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
            Pick a situation:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPageRow}>
            {quickPages.map(tp => {
              const isActive = activeQuickPage?.id === tp.id;
              return (
                <TouchableOpacity
                  key={tp.id}
                  style={[styles.quickPageCard, { backgroundColor: isActive ? tp.color : palette.cardBg, borderColor: tp.color }]}
                  onPress={() => selectQuickPage(tp)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tp.label} quick page`}
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
});
