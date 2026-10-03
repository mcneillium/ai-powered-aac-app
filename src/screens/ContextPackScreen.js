// src/screens/ContextPackScreen.js
// Situations: ready-made phrases for where you are (Home, School, Meals…).
// The chosen situation is shared with the board's situation chip, so its
// phrases are also one tap away there. Phrases speak immediately on tap.

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, getExperience, fitzgerald, fonts, radii, spacing } from '../theme';
import { speak, buildSpeechOptions } from '../services/speechService';
import { getAllContextPacks, getContextPack } from '../data/contextPacks';
import { tabBarSpace } from '../components/tabBarMetrics';
import { StatusBar } from 'expo-status-bar';
import { t } from '../i18n/strings';

// Phrase purpose → Fitzgerald colour family, so situations read like the board.
const CATEGORY_KEY = {
  request: 'starter',
  urgent: 'important',
  feeling: 'adjective',
  social: 'social',
  repair: 'noun',
  comment: 'misc',
  regulation: 'verb',
};

export default function ContextPackScreen() {
  const { settings, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const insets = useSafeAreaInsets();
  const activePackId = settings.activeSituation || null;

  const packs = getAllContextPacks();
  const activePack = activePackId ? getContextPack(activePackId) : null;
  const numColumns = Math.min(settings.gridSize || 3, 3);
  const fz = fitzgerald[settings.theme] || fitzgerald.light;
  const child = experience.tileFill === 'tint';

  const speakPhrase = useCallback((phrase) => {
    speak(phrase.label, buildSpeechOptions(settings));
  }, [settings]);

  const renderPhrase = ({ item }) => {
    const c = fz[CATEGORY_KEY[item.category] || 'misc'];
    return (
      <TouchableOpacity
        style={[
          styles.phraseBtn,
          {
            backgroundColor: child && settings.theme !== 'highContrast' ? c.tint : palette.tileBg,
            borderColor: child ? 'transparent' : palette.tileBorder,
            borderRadius: experience.tileRadius,
            flex: 1 / numColumns,
          },
        ]}
        onPress={() => speakPhrase(item)}
        accessibilityRole="button"
        accessibilityLabel={`Say: ${item.label}`}
        accessibilityHint="Speaks this phrase immediately"
        activeOpacity={0.7}
      >
        <View style={[styles.cap, { backgroundColor: c.cap, height: experience.capHeight }]} importantForAccessibility="no" />
        <Text style={[styles.phraseText, { color: palette.text }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <FlatList
        data={packs}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const on = item.id === activePackId;
          return (
            <TouchableOpacity
              style={[styles.packChip, { backgroundColor: on ? palette.primary : palette.cardBg, borderColor: on ? palette.primary : palette.tileBorder }]}
              onPress={() => updateSettings({ activeSituation: on ? null : item.id })}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} ${t('contextPack')}`}
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={item.icon} size={20} color={on ? palette.buttonText : palette.text} />
              <Text style={[styles.packLabel, { color: on ? palette.buttonText : palette.text }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.packList}
        style={styles.packListContainer}
      />

      {activePack ? (
        <FlatList
          data={activePack.phrases}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`ctx-${numColumns}`}
          renderItem={renderPhrase}
          contentContainerStyle={[styles.phraseGrid, { paddingBottom: tabBarSpace(insets.bottom) + 12 }]}
        />
      ) : (
        <View style={[styles.emptyState, { paddingBottom: tabBarSpace(insets.bottom) }]}>
          <View style={[styles.emptyIcon, { backgroundColor: palette.primaryMuted }]}>
            <Ionicons name="compass" size={44} color={palette.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: experience.headlineFont }]}>{t('chooseContext')}</Text>
          <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
            {t('chooseContextHint')} It also shows on your board.
          </Text>
        </View>
      )}

      <StatusBar style={settings.theme === 'dark' || settings.theme === 'highContrast' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  packListContainer: { flexGrow: 0 },
  packList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  packChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48,
    paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1.5,
  },
  packLabel: { fontSize: 16, fontFamily: fonts.bold },
  phraseGrid: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  phraseBtn: {
    margin: 4, borderWidth: 1, height: 104, paddingHorizontal: spacing.sm, paddingTop: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  cap: { position: 'absolute', top: 0, left: 0, right: 0 },
  phraseText: { fontSize: 17, fontFamily: fonts.bold, textAlign: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  emptyIcon: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 24 },
  emptySubtitle: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, textAlign: 'center' },
});
