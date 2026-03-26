// src/screens/InsightsScreen.js
// Vocabulary gap insights and usage analytics for caregivers.
// Shows: missing words, frequent phrases, peak hours, suggestion effectiveness.
// All data comes from the local AI profile — no cloud sync required.

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, spacing, radii } from '../theme';
import { getVocabularyGapInsights, hasLearnedData } from '../services/aiProfileStore';
import { StatusBar } from 'expo-status-bar';
import { t } from '../i18n/strings';

export default function InsightsScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const [insights, setInsights] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = () => {
    setInsights(getVocabularyGapInsights());
  };

  useEffect(() => { loadInsights(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadInsights();
    setRefreshing(false);
  };

  if (!insights || !hasLearnedData()) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: palette.background }]}>
        <Ionicons name="analytics-outline" size={48} color={palette.textSecondary} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No data yet</Text>
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
          Use the AAC board to build sentences. Insights will appear here as patterns emerge.
        </Text>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats summary */}
      <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Usage Summary</Text>
        <View style={styles.statsGrid}>
          <StatItem label="Words used" value={insights.stats.totalWords} palette={palette} />
          <StatItem label="Sentences" value={insights.stats.totalSentences} palette={palette} />
          <StatItem label="Vocabulary" value={`${insights.stats.vocabularySize} words`} palette={palette} />
          <StatItem label="Suggestion use" value={insights.stats.suggestionAcceptanceRate} palette={palette} />
        </View>
      </View>

      {/* Missing words */}
      {insights.missingWords.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="search-outline" size={18} color={palette.warning} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Words searched but not found</Text>
          </View>
          <Text style={[styles.cardHint, { color: palette.textSecondary }]}>
            Consider adding these to the vocabulary
          </Text>
          {insights.missingWords.map((item, i) => (
            <View key={i} style={[styles.insightRow, { borderBottomColor: palette.border }]}>
              <Text style={[styles.insightLabel, { color: palette.text }]}>{item.term}</Text>
              <Text style={[styles.insightCount, { color: palette.textSecondary }]}>searched {item.count}x</Text>
            </View>
          ))}
        </View>
      )}

      {/* Frequent phrases */}
      {insights.frequentPhrases.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="star-outline" size={18} color={palette.primary} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Frequent phrases</Text>
          </View>
          <Text style={[styles.cardHint, { color: palette.textSecondary }]}>
            These are used often — consider making them one-tap quick phrases
          </Text>
          {insights.frequentPhrases.map((item, i) => (
            <View key={i} style={[styles.insightRow, { borderBottomColor: palette.border }]}>
              <Text style={[styles.insightLabel, { color: palette.text }]}>"{item.phrase}"</Text>
              <Text style={[styles.insightCount, { color: palette.textSecondary }]}>{item.count}x</Text>
            </View>
          ))}
        </View>
      )}

      {/* Peak hours */}
      {insights.peakHours.length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color={palette.info} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Peak usage times</Text>
          </View>
          {insights.peakHours.map((item, i) => (
            <View key={i} style={[styles.insightRow, { borderBottomColor: palette.border }]}>
              <Text style={[styles.insightLabel, { color: palette.text }]}>{item.label}</Text>
              <Text style={[styles.insightCount, { color: palette.textSecondary }]}>{item.count} interactions</Text>
            </View>
          ))}
        </View>
      )}

      {/* Source effectiveness */}
      {insights.stats.sourceEffectiveness && Object.keys(insights.stats.sourceEffectiveness).length > 0 && (
        <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="sparkles-outline" size={18} color={palette.accent} />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Suggestion sources</Text>
          </View>
          <Text style={[styles.cardHint, { color: palette.textSecondary }]}>
            How often each suggestion type is accepted
          </Text>
          {Object.entries(insights.stats.sourceEffectiveness).map(([source, rate]) => (
            <View key={source} style={[styles.insightRow, { borderBottomColor: palette.border }]}>
              <Text style={[styles.insightLabel, { color: palette.text }]}>{source}</Text>
              <Text style={[styles.insightCount, { color: palette.textSecondary }]}>
                {(rate * 100).toFixed(0)}% accepted
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 80 }} />
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

function StatItem({ label, value, palette }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: palette.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: spacing.lg },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: spacing.sm },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardHint: { fontSize: 13, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  statItem: { flex: 1, minWidth: '40%', alignItems: 'center', paddingVertical: spacing.sm },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  insightLabel: { fontSize: 15, flex: 1 },
  insightCount: { fontSize: 13, fontWeight: '500' },
});
