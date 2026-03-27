// src/screens/InsightsScreen.js
// Vocabulary gap insights and communication analytics for caregivers.
// Shows actionable data from the on-device AI profile.
// All data is local — nothing is sent to the cloud.

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii, shadows } from '../theme';
import {
  getVocabularyGapInsights, getTopWords, hasLearnedData,
} from '../services/aiProfileStore';
import { getFrequentSentences } from '../services/sentenceHistoryStore';
import { StatusBar } from 'expo-status-bar';

export default function InsightsScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [insights, setInsights] = useState(null);
  const [topWords, setTopWords] = useState([]);
  const [topSentences, setTopSentences] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setInsights(getVocabularyGapInsights());
    setTopWords(getTopWords(10));
    setTopSentences(getFrequentSentences(5));
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  };

  if (!hasLearnedData()) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: palette.background }]}>
        <Ionicons name="analytics-outline" size={48} color={palette.textSecondary} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No data yet</Text>
        <Text style={[styles.emptyHint, { color: palette.textSecondary }]}>
          Use the AAC board to build and speak sentences. Insights will appear here as patterns emerge.
        </Text>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  const stats = insights?.stats || {};

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── Summary ── */}
      <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Usage overview</Text>
        <View style={styles.statsRow}>
          <Stat label="Words tapped" value={stats.totalWords || 0} palette={palette} />
          <Stat label="Sentences spoken" value={stats.totalSentences || 0} palette={palette} />
          <Stat label="Vocabulary size" value={stats.vocabularySize || 0} palette={palette} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Suggestion acceptance" value={stats.suggestionAcceptanceRate || '—'} palette={palette} />
        </View>
      </View>

      {/* ── Most used words ── */}
      {topWords.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="chatbubble-outline" color={palette.primary} title="Most used words" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            The words this user taps most often
          </Text>
          <View style={styles.wordCloud}>
            {topWords.map((w, i) => (
              <View key={w} style={[styles.wordChip, { backgroundColor: palette.primaryMuted }]}>
                <Text style={[styles.wordChipText, { color: palette.primary }]}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Frequent sentences ── */}
      {topSentences.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="repeat-outline" color={palette.info} title="Frequently spoken" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Sentences spoken multiple times — good candidates for quick phrase buttons
          </Text>
          {topSentences.map((item, i) => (
            <Row key={i} left={`"${item.text}"`} right={`${item.speakCount || 1}x`} palette={palette} />
          ))}
        </View>
      )}

      {/* ── Missing words ── */}
      {insights?.missingWords?.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="search-outline" color={palette.warning} title="Words searched but not found" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            The user searched for these words but they aren't in the vocabulary. Consider adding them.
          </Text>
          {insights.missingWords.map((item, i) => (
            <Row key={i} left={item.term} right={`searched ${item.count}x`} palette={palette} />
          ))}
        </View>
      )}

      {/* ── Frequent phrases to promote ── */}
      {insights?.frequentPhrases?.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="star-outline" color="#FF9800" title="Phrases to promote" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            These phrases are used so often they should be one-tap quick phrase buttons
          </Text>
          {insights.frequentPhrases.map((item, i) => (
            <Row key={i} left={`"${item.phrase}"`} right={`${item.count}x`} palette={palette} />
          ))}
        </View>
      )}

      {/* ── Peak usage hours ── */}
      {insights?.peakHours?.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="time-outline" color={palette.accent} title="Peak communication times" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            When this user communicates most — helpful for scheduling support
          </Text>
          {insights.peakHours.map((item, i) => (
            <Row key={i} left={item.label} right={`${item.count} interactions`} palette={palette} />
          ))}
        </View>
      )}

      {/* ── Suggestion effectiveness ── */}
      {stats.sourceEffectiveness && Object.keys(stats.sourceEffectiveness).length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg, ...shadows.card }]}>
          <SectionHeader icon="sparkles-outline" color={palette.primary} title="What suggestions work best" palette={palette} />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            How often the user accepts suggestions from each source. Higher is better.
          </Text>
          {Object.entries(stats.sourceEffectiveness).map(([source, rate]) => (
            <View key={source} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: palette.text }]}>{formatSource(source)}</Text>
              <View style={[styles.barTrack, { backgroundColor: palette.chipBg }]}>
                <View style={[styles.barFill, { width: `${Math.round(rate * 100)}%`, backgroundColor: palette.primary }]} />
              </View>
              <Text style={[styles.barValue, { color: palette.textSecondary }]}>{Math.round(rate * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

function SectionHeader({ icon, color, title, palette }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
    </View>
  );
}

function Stat({ label, value, palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: palette.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Row({ left, right, palette }) {
  return (
    <View style={[styles.row, { borderBottomColor: palette.border }]}>
      <Text style={[styles.rowLeft, { color: palette.text }]} numberOfLines={1}>{left}</Text>
      <Text style={[styles.rowRight, { color: palette.textSecondary }]}>{right}</Text>
    </View>
  );
}

function formatSource(source) {
  switch (source) {
    case 'bigram': return 'Personal history';
    case 'neural': return 'AI model';
    case 'vertex': return 'Cloud AI';
    case 'frequency': return 'Word frequency';
    default: return source;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: spacing.lg },
  emptyHint: { fontSize: 15, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  card: { marginHorizontal: spacing.md, marginTop: spacing.lg, borderRadius: radii.md, padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', marginTop: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  wordCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  wordChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  wordChipText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft: { fontSize: 14, flex: 1, marginRight: spacing.sm },
  rowRight: { fontSize: 13, fontWeight: '500' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs, gap: spacing.sm },
  barLabel: { fontSize: 13, width: 100 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 12, width: 36, textAlign: 'right' },
});
