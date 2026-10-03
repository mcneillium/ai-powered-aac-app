// src/screens/LearningScreen.js
// "What Voice has learned": everything the personal suggestions are based
// on, in plain words, with control over each piece. Learning is opt-in,
// stays on this device, and can be paused, edited or cleared here at any time.

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, getExperience, fonts, radii, spacing } from '../theme';
import {
  loadAIProfile, getLearnedSummary, forgetLearnedWord, unblockSuggestion, resetAIProfile,
} from '../services/aiProfileStore';

export default function LearningScreen() {
  const { settings, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const learningOn = settings.localLearning === true;
  const [summary, setSummary] = useState(null);

  const refresh = useCallback(() => {
    loadAIProfile().then(() => setSummary(getLearnedSummary(60))).catch(() => setSummary(getLearnedSummary(60)));
  }, []);
  useFocusEffect(refresh);

  const forget = (word) => {
    forgetLearnedWord(word).then(refresh).catch(() => {});
  };
  const unblock = (word) => {
    unblockSuggestion(word).then(refresh).catch(() => {});
  };
  const clearAll = () => {
    Alert.alert(
      'Clear everything learned?',
      'Suggestions go back to the built-in ones. Your words, favourites, history and settings are not touched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => { resetAIProfile().then(refresh).catch(() => {}); },
        },
      ]
    );
  };

  const card = [styles.card, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }];
  const words = summary ? summary.words : [];
  const blocked = summary ? summary.blocked : [];

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <View style={card}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => updateSettings({ localLearning: !learningOn })}
          style={styles.switchRow}
          accessible
          accessibilityRole="switch"
          accessibilityLabel="Learn from my words"
          accessibilityState={{ checked: learningOn }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.h2, { color: palette.text, fontFamily: experience.headlineFont }]}>Learn from my words</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {learningOn
                ? 'On. Suggestions include words and pairs you use. Everything stays on this device.'
                : 'Off. Suggestions are the built-in ones only, and nothing new is learned.'}
            </Text>
          </View>
          <Switch
            value={learningOn}
            onValueChange={(v) => updateSettings({ localLearning: v })}
            trackColor={{ true: palette.primary, false: palette.border }}
            thumbColor={palette.cardBg}
          />
        </TouchableOpacity>
        <View style={[styles.factRow, { borderTopColor: palette.border }]}>
          <Fact palette={palette} n={summary ? summary.wordCount : 0} label="words" />
          <Fact palette={palette} n={summary ? summary.pairCount : 0} label="word pairs" />
          <Fact palette={palette} n={blocked.length} label="not suggested" />
        </View>
      </View>

      <Text style={[styles.section, { color: palette.textSecondary }]}>HOW IT WORKS</Text>
      <View style={card}>
        {[
          ['phone-portrait-outline', 'Kept on this device. Never sent anywhere, never synced.'],
          ['grid-outline', 'Only the suggestion row changes. Words on the board never move.'],
          ['hourglass-outline', 'Older habits fade over about a month, so it follows how you talk now.'],
          ['hand-left-outline', 'Long-press a suggestion to stop it being suggested.'],
        ].map(([icon, text]) => (
          <View key={icon} style={styles.howRow}>
            <Ionicons name={icon} size={20} color={palette.primary} />
            <Text style={[styles.body, { color: palette.text, flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: palette.textSecondary }]}>WORDS IT HAS LEARNED</Text>
      <View style={card}>
        {words.length === 0 ? (
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            Nothing yet.{learningOn ? ' Words you use will appear here.' : ''}
          </Text>
        ) : words.map((w) => (
          <View key={w.word} style={[styles.itemRow, { borderBottomColor: palette.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemWord, { color: palette.text }]}>{w.word === 'i' ? 'I' : w.word}</Text>
              <Text style={[styles.small, { color: palette.textSecondary }]}>
                {w.uses >= 10 ? 'used a lot' : w.uses >= 3 ? 'used often' : 'used a few times'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => forget(w.word)}
              style={[styles.smallBtn, { backgroundColor: palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel={`Forget ${w.word}`}
            >
              <Text style={[styles.smallBtnText, { color: palette.text }]}>Forget</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {blocked.length > 0 && (
        <>
          <Text style={[styles.section, { color: palette.textSecondary }]}>NEVER SUGGESTED</Text>
          <View style={card}>
            {blocked.map((w) => (
              <View key={w} style={[styles.itemRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.itemWord, { color: palette.text, flex: 1 }]}>{w}</Text>
                <TouchableOpacity
                  onPress={() => unblock(w)}
                  style={[styles.smallBtn, { backgroundColor: palette.surface }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggest ${w} again`}
                >
                  <Text style={[styles.smallBtnText, { color: palette.text }]}>Undo</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={clearAll}
        style={[styles.danger, { borderColor: palette.danger }]}
        accessibilityRole="button"
        accessibilityLabel="Clear everything learned"
      >
        <Ionicons name="trash-outline" size={20} color={palette.danger} />
        <Text style={[styles.dangerText, { color: palette.danger }]}>Clear everything learned</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Fact({ palette, n, label }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${n} ${label}`}>
      <Text style={[styles.factN, { color: palette.text }]}>{n}</Text>
      <Text style={[styles.small, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  h2: { fontSize: 20, marginBottom: 4 },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fonts.regular },
  small: { fontSize: 13, fontFamily: fonts.regular },
  factRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, marginTop: spacing.xs },
  fact: { flex: 1, alignItems: 'center' },
  factN: { fontSize: 24, fontFamily: fonts.bold },
  section: { fontSize: 13, fontFamily: fonts.bold, letterSpacing: 0.8, marginTop: spacing.md, marginLeft: spacing.xs },
  howRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  itemWord: { fontSize: 18, fontFamily: fonts.bold },
  smallBtn: { minWidth: 76, minHeight: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  smallBtnText: { fontSize: 15, fontFamily: fonts.bold },
  danger: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    minHeight: 52, borderRadius: radii.lg, borderWidth: 1.5, marginTop: spacing.lg,
  },
  dangerText: { fontSize: 16, fontFamily: fonts.bold },
});
