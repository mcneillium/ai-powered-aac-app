// src/components/board/SuggestionRow.js
// The fixed suggestion area: always the same height and the same number of
// equal slots, whether there are suggestions or not. A suggestion that stays
// relevant keeps its slot (predictionEngine.placeInSlots), empty slots stay
// as outlines, and the row never scrolls — so neither the row nor the word
// grid below it moves while the user is building a message.
//
// Suggestions are only added on an explicit tap. Long-press offers
// "Don't suggest this" (the word stays on the board).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fonts } from '../../theme';
import { stripHeight } from '../../utils/suggestionChipFit';

export default function SuggestionRow({
  slots, palette, experience, textScale, chipFit, onPress, onLongPress, isFocused, focusStyle, learningOn,
}) {
  return (
    <View
      style={[styles.row, { height: stripHeight(textScale) }]}
      accessibilityRole="none"
      accessibilityLabel={learningOn ? 'Suggestions, including words learned on this device' : 'Suggestions'}
    >
      {slots.map((s, i) => {
        if (!s) {
          return (
            <View
              key={`empty-${i}`}
              style={[styles.slot, styles.empty, { borderColor: palette.emptySlot, borderRadius: experience.chipRadius }]}
              importantForAccessibility="no-hide-descendants"
            />
          );
        }
        const focused = isFocused(i);
        const learned = s.source === 'personal';
        return (
          <TouchableOpacity
            key={`${s.word}-${i}`}
            style={[
              styles.slot,
              {
                backgroundColor: palette.chipBg,
                borderColor: learned ? palette.primary : 'transparent',
                borderRadius: experience.chipRadius,
              },
              focused && focusStyle,
            ]}
            onPress={() => onPress(s.word)}
            onLongPress={() => onLongPress(s.word)}
            delayLongPress={600}
            accessibilityRole="button"
            accessibilityLabel={`Suggestion: ${s.display}${s.reason ? `. ${s.reason}` : ''}`}
            accessibilityHint="Adds this word to your message. Long press to stop suggesting it."
            accessibilityActions={[{ name: 'longpress', label: "Don't suggest this" }]}
            onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'longpress') onLongPress(s.word); }}
          >
            <Text
              style={[styles.word, { color: palette.onPrimaryMuted, fontSize: Math.round(15 * textScale), lineHeight: chipFit.wordLineHeight, fontFamily: fonts.bold }]}
              maxFontSizeMultiplier={chipFit.wordMaxMultiplier}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {s.display}
            </Text>
            {s.reason && chipFit.showReason ? (
              <Text
                style={[styles.reason, { color: palette.textSecondary, fontFamily: fonts.regular }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1}
              >
                {s.reason}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 4, gap: 8 },
  slot: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { borderStyle: 'dashed', borderWidth: 1.5 },
  word: { textAlign: 'center' },
  reason: { fontSize: 10, marginTop: 1, textAlign: 'center' },
});
