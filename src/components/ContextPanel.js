// src/components/ContextPanel.js
// Situation panel on the board: pick where you are (Home, School, Meals…)
// and get that situation's ready-made phrases one tap away, without leaving
// the board or moving any word on it. The chosen situation is remembered on
// this device and shown on the board header.

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet, { useAfterClose } from './Sheet';
import { getAllContextPacks, getContextPack } from '../data/contextPacks';
import { fonts, radii, spacing } from '../theme';

export default function ContextPanel({
  visible, onClose, palette, experience, situationId, onChooseSituation, onUsePhrase, onHelpExplain,
}) {
  const packs = getAllContextPacks();
  const pack = situationId ? getContextPack(situationId) : null;
  const { closeThen, onDismiss } = useAfterClose(onClose);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title={pack ? pack.label : 'Where are you?'}
      tall
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.packs}
        style={styles.packRow}
      >
        {packs.map((p) => {
          const on = p.id === situationId;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onChooseSituation(on ? null : p.id)}
              style={[styles.pack, { backgroundColor: on ? palette.primary : palette.cardBg, borderColor: on ? palette.primary : palette.border }]}
              accessibilityRole="button"
              accessibilityLabel={on ? `${p.label}, chosen. Tap to clear` : `${p.label} situation`}
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={p.icon} size={20} color={on ? palette.buttonText : palette.text} />
              <Text style={[styles.packText, { color: on ? palette.buttonText : palette.text }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        onPress={() => closeThen(onHelpExplain)}
        style={[styles.explain, { backgroundColor: palette.primaryMuted, borderRadius: experience.chipRadius }]}
        accessibilityRole="button"
        accessibilityLabel="Help me explain. Build a full message step by step"
      >
        <Text style={styles.explainEmoji} importantForAccessibility="no">🧩</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.explainTitle, { color: palette.onPrimaryMuted }]}>Help me explain</Text>
          <Text style={[styles.explainSub, { color: palette.text }]}>Pain, a need, a feeling, or something that happened</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.onPrimaryMuted} />
      </TouchableOpacity>

      {pack ? (
        <ScrollView contentContainerStyle={styles.phrases}>
          {pack.phrases.map((ph) => (
            <TouchableOpacity
              key={ph.id}
              onPress={() => closeThen(() => onUsePhrase(ph.label))}
              style={[styles.phrase, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.chipRadius }]}
              accessibilityRole="button"
              accessibilityLabel={`Say: ${ph.label}`}
            >
              <View style={[styles.dot, { backgroundColor: ph.category === 'urgent' ? palette.danger : palette.primary }]} />
              <Text style={[styles.phraseText, { color: palette.text }]}>{ph.label}</Text>
              <Ionicons name="volume-high-outline" size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Choose a situation to keep its phrases one tap away on the board.
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  packRow: { flexGrow: 0, marginBottom: spacing.md },
  packs: { gap: spacing.sm, paddingRight: spacing.lg },
  pack: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 48,
    borderRadius: radii.pill, borderWidth: 1.5,
  },
  packText: { fontSize: 16, fontFamily: fonts.bold },
  explain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 64, marginBottom: spacing.md },
  explainEmoji: { fontSize: 28 },
  explainTitle: { fontSize: 17, fontFamily: fonts.bold },
  explainSub: { fontSize: 14, fontFamily: fonts.regular, marginTop: 2 },
  phrases: { gap: spacing.sm, paddingBottom: spacing.lg },
  phrase: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56,
    paddingHorizontal: spacing.md, borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  phraseText: { flex: 1, fontSize: 18, fontFamily: fonts.bold },
  hint: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, paddingVertical: spacing.md },
});
