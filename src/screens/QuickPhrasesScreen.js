// src/screens/QuickPhrasesScreen.js
// One-tap quick phrases organized by category with personalized section.
// Time-smart ordering: phrases relevant to the current time of day appear first.
// Works fully offline — all data from local stores.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii, shadows } from '../theme';
import { speak, applyPreset } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';
import {
  getRepeatedPhrases,
  recordSentenceSpoken,
} from '../services/aiProfileStore';
import {
  getFavourites,
  loadFavourites,
} from '../services/favouritesStore';
import { getContextSuggestions } from '../services/contextAgent';
import { StatusBar } from 'expo-status-bar';
import { recordActivity } from '../services/caregiverAlerts';

const QUICK_CATEGORIES = [
  {
    id: 'greetings',
    label: 'Greetings',
    icon: 'hand-left-outline',
    color: '#4CAF50',
    phrases: ['Hello', 'Good morning', 'Good afternoon', 'Good evening', 'Goodbye', 'See you later', 'How are you?', 'Nice to see you'],
  },
  {
    id: 'needs',
    label: 'I need...',
    icon: 'alert-circle-outline',
    color: '#2979FF',
    phrases: ['I need help', 'I need the toilet', 'I need water', 'I need a break', 'I need food', 'I need medicine', 'I need space', 'I need quiet'],
  },
  {
    id: 'responses',
    label: 'Responses',
    icon: 'chatbubble-outline',
    color: '#FF9800',
    phrases: ['Yes', 'No', 'Maybe', 'I think so', "I don't know", 'OK', 'Not yet', 'Please wait'],
  },
  {
    id: 'manners',
    label: 'Manners',
    icon: 'heart-outline',
    color: '#E91E63',
    phrases: ['Please', 'Thank you', 'Sorry', 'Excuse me', "You're welcome", 'No thank you', 'That was nice', 'Good job'],
  },
  {
    id: 'feelings',
    label: 'Feelings',
    icon: 'happy-outline',
    color: '#7E57C2',
    phrases: ["I'm happy", "I'm sad", "I'm tired", "I'm angry", "I'm scared", "I'm worried", "I'm excited", "I'm OK"],
  },
  {
    id: 'questions',
    label: 'Questions',
    icon: 'help-circle-outline',
    color: '#00BCD4',
    phrases: ['What is that?', 'Where are we going?', 'When?', 'Can I have?', 'Who is that?', 'Why?', 'How much?', 'Can you help?'],
  },
];

function getTimeRelevantCategory() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'greetings';
  if (hour >= 12 && hour < 14) return 'needs';
  if (hour >= 17 && hour < 21) return 'feelings';
  return 'responses';
}

export default function QuickPhrasesScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [refreshing, setRefreshing] = useState(false);
  const [favourites, setFavourites] = useState([]);
  const [personalPhrases, setPersonalPhrases] = useState([]);
  const [contextSuggestions, setContextSuggestions] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(getTimeRelevantCategory());

  const aiEnabled = settings.aiPersonalisationEnabled !== false;

  const load = useCallback(async () => {
    await loadFavourites();
    setFavourites(getFavourites());

    if (aiEnabled) {
      const repeated = getRepeatedPhrases(2, 8);
      setPersonalPhrases(repeated.map(r => r.phrase));
      setContextSuggestions(getContextSuggestions([], { maxSuggestions: 6 }));
    }
  }, [aiEnabled]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const speakPhrase = useCallback((phrase) => {
    speak(phrase, applyPreset('normal', {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    }));
    addSentenceToHistory(phrase).catch(() => {});
    if (aiEnabled) {
      recordSentenceSpoken(phrase.split(' ')).catch(() => {});
    }
    recordActivity().catch(() => {});
  }, [settings, aiEnabled]);

  const timeCategory = getTimeRelevantCategory();
  const sortedCategories = [
    ...QUICK_CATEGORIES.filter(c => c.id === timeCategory),
    ...QUICK_CATEGORIES.filter(c => c.id !== timeCategory),
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── Context-aware suggestions ── */}
      {contextSuggestions.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={18} color={palette.accent} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Suggested right now</Text>
          </View>
          <View style={styles.phraseGrid}>
            {contextSuggestions.map((s, i) => (
              <TouchableOpacity
                key={`ctx-${i}`}
                style={[styles.phraseChip, { backgroundColor: palette.primaryMuted, borderColor: palette.primary }]}
                onPress={() => speakPhrase(s.word)}
                accessibilityRole="button"
                accessibilityLabel={`Speak: ${s.word}`}
                accessibilityHint={s.reason}
              >
                <Text style={[styles.phraseText, { color: palette.primary }]}>{s.word}</Text>
                <Text style={[styles.phraseReason, { color: palette.textSecondary }]}>{s.reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Favourites ── */}
      {favourites.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={18} color={palette.warning} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Favourites</Text>
          </View>
          <View style={styles.phraseGrid}>
            {favourites.slice(0, 12).map(fav => (
              <TouchableOpacity
                key={fav.id}
                style={[styles.phraseChip, { backgroundColor: palette.chipBg, borderColor: palette.warning }]}
                onPress={() => speakPhrase(fav.phrase)}
                accessibilityRole="button"
                accessibilityLabel={`Speak favourite: ${fav.phrase}`}
              >
                <Text style={[styles.phraseText, { color: palette.text }]}>{fav.phrase}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Personal phrases ── */}
      {personalPhrases.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={palette.info} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Your phrases</Text>
          </View>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Phrases you use often
          </Text>
          <View style={styles.phraseGrid}>
            {personalPhrases.map((phrase, i) => (
              <TouchableOpacity
                key={`personal-${i}`}
                style={[styles.phraseChip, { backgroundColor: palette.chipBg, borderColor: palette.info }]}
                onPress={() => speakPhrase(phrase)}
                accessibilityRole="button"
                accessibilityLabel={`Speak: ${phrase}`}
              >
                <Text style={[styles.phraseText, { color: palette.text }]}>{phrase}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Category-based phrases ── */}
      {sortedCategories.map(cat => {
        const isExpanded = expandedCategory === cat.id;
        const isTimeRelevant = cat.id === timeCategory;
        return (
          <View key={cat.id} style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => setExpandedCategory(isExpanded ? null : cat.id)}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label} category${isTimeRelevant ? ' (suggested for now)' : ''}`}
              accessibilityState={{ expanded: isExpanded }}
            >
              <Ionicons name={cat.icon} size={20} color={cat.color} />
              <Text style={[styles.sectionTitle, { color: palette.text, flex: 1 }]}>{cat.label}</Text>
              {isTimeRelevant && (
                <View style={[styles.timeBadge, { backgroundColor: cat.color }]}>
                  <Text style={styles.timeBadgeText}>Now</Text>
                </View>
              )}
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
            {isExpanded && (
              <View style={styles.phraseGrid}>
                {cat.phrases.map((phrase, i) => (
                  <TouchableOpacity
                    key={`${cat.id}-${i}`}
                    style={[styles.phraseBtn, { backgroundColor: cat.color }]}
                    onPress={() => speakPhrase(phrase)}
                    accessibilityRole="button"
                    accessibilityLabel={`Speak: ${phrase}`}
                  >
                    <Text style={styles.phraseBtnText}>{phrase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  phraseChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  phraseText: { fontSize: 15, fontWeight: '500' },
  phraseReason: { fontSize: 10, marginTop: 1 },
  phraseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  phraseBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
  },
  timeBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
});
