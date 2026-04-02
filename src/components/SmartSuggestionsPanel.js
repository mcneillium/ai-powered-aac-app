// src/components/SmartSuggestionsPanel.js
// Surfaces personalized learning insights as actionable AAC shortcuts.
// Reads from existing stores (aiProfileStore, sentenceHistoryStore, favouritesStore)
// and presents suggestions the user can act on immediately.
//
// Every suggestion has an explainable reason (used often, repeated, searched but missing).
// User-controlled: nothing is auto-spoken or auto-created.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../theme';
import { getFrequentSentences } from '../services/sentenceHistoryStore';
import {
  getRepeatedPhrases, getFrequentFailedSearches, getTopWords,
} from '../services/aiProfileStore';
import { isFavourite, addFavourite, getFavourites } from '../services/favouritesStore';
import { speak } from '../services/speechService';
import { addSentenceToHistory } from '../services/sentenceHistoryStore';

/**
 * Build a ranked list of smart suggestions from existing user data.
 * Each suggestion has: text, reason (explainable), type, action.
 */
function buildSuggestions() {
  const suggestions = [];
  const seen = new Set();

  // 1. Frequent full sentences not yet in favourites
  const frequent = getFrequentSentences(20);
  for (const item of frequent) {
    if (item.speakCount >= 3 && !isFavourite(item.text) && !seen.has(item.text)) {
      suggestions.push({
        text: item.text,
        reason: `Spoken ${item.speakCount} times`,
        type: 'frequent_phrase',
        icon: 'repeat-outline',
        color: '#FF9800',
      });
      seen.add(item.text);
    }
  }

  // 2. Repeated multi-word phrases from AI profile (bigram/phrase patterns)
  const repeated = getRepeatedPhrases(3, 10);
  for (const item of repeated) {
    if (!isFavourite(item.phrase) && !seen.has(item.phrase)) {
      suggestions.push({
        text: item.phrase,
        reason: `Used ${item.count} times`,
        type: 'repeated_pattern',
        icon: 'trending-up-outline',
        color: '#7C4DFF',
      });
      seen.add(item.phrase);
    }
  }

  // 3. Failed searches — words the user looked for but couldn't find
  const gaps = getFrequentFailedSearches(2);
  for (const item of gaps) {
    if (!seen.has(item.term)) {
      suggestions.push({
        text: item.term,
        reason: `Searched ${item.count} times but not found`,
        type: 'missing_word',
        icon: 'search-outline',
        color: '#F44336',
      });
      seen.add(item.term);
    }
  }

  // 4. Top words used frequently as sentence starters (from bigrams starting with common starters)
  const topWords = getTopWords(10);
  const starters = ['I', 'can', 'please', 'help', 'want', 'need', 'more', 'yes', 'no', 'stop'];
  for (const word of topWords) {
    if (starters.includes(word.toLowerCase()) && !seen.has(word)) {
      // Don't add starters as suggestions — they're already in core vocab
      // But note them for the reason labels on other suggestions
    }
  }

  // Sort: missing words first (urgent), then by frequency/count
  suggestions.sort((a, b) => {
    if (a.type === 'missing_word' && b.type !== 'missing_word') return -1;
    if (b.type === 'missing_word' && a.type !== 'missing_word') return 1;
    return 0; // preserve existing order within type
  });

  return suggestions.slice(0, 8);
}

export default function SmartSuggestionsPanel({
  visible,
  palette,
  settings,
  onSpeakPhrase, // (text) => void — loads words into sentence bar and speaks
  onAddWord,     // (word) => void — adds a word to custom vocab
  onRefresh,     // () => void — refresh favourites after adding
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  // Rebuild suggestions when panel opens
  useEffect(() => {
    if (visible) {
      setSuggestions(buildSuggestions());
    }
  }, [visible]);

  const handleSpeak = useCallback((text) => {
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    addSentenceToHistory(text).catch(() => {});
    if (onSpeakPhrase) onSpeakPhrase(text);
  }, [settings, onSpeakPhrase]);

  const handleSaveToFavourites = useCallback(async (text) => {
    await addFavourite(text);
    setSuggestions(prev => prev.map(s =>
      s.text === text ? { ...s, saved: true } : s
    ));
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleDismiss = useCallback((text) => {
    setDismissed(prev => new Set([...prev, text]));
  }, []);

  if (!visible) return null;

  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.text));

  if (visibleSuggestions.length === 0) {
    return (
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.panelHeader}>
          <Ionicons name="bulb-outline" size={16} color={palette.textSecondary} />
          <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>Smart Suggestions</Text>
        </View>
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
          Keep communicating — suggestions appear as you use the app more.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.panelHeader}>
        <Ionicons name="bulb-outline" size={16} color={palette.warning} />
        <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>Smart Suggestions</Text>
      </View>
      <ScrollView style={styles.scrollArea} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {visibleSuggestions.map((item, idx) => (
          <View key={`${item.text}-${idx}`} style={[styles.suggestionRow, { backgroundColor: palette.cardBg }]}>
            <TouchableOpacity
              style={styles.suggestionMain}
              onPress={() => handleSpeak(item.text)}
              accessibilityRole="button"
              accessibilityLabel={`Say: ${item.text}. ${item.reason}`}
            >
              <Ionicons name={item.icon} size={16} color={item.color} />
              <View style={styles.suggestionTextArea}>
                <Text style={[styles.suggestionText, { color: palette.text }]} numberOfLines={1}>
                  {item.text}
                </Text>
                <Text style={[styles.suggestionReason, { color: palette.textSecondary }]}>
                  {item.reason}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.suggestionActions}>
              {item.type !== 'missing_word' && !item.saved && (
                <TouchableOpacity
                  onPress={() => handleSaveToFavourites(item.text)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Save "${item.text}" to favourites`}
                >
                  <Ionicons name="star-outline" size={18} color={palette.warning} />
                </TouchableOpacity>
              )}
              {item.saved && (
                <Ionicons name="star" size={18} color={palette.warning} />
              )}
              {item.type === 'missing_word' && onAddWord && (
                <TouchableOpacity
                  onPress={() => { onAddWord(item.text); handleDismiss(item.text); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add "${item.text}" to your vocabulary`}
                >
                  <Ionicons name="add-circle-outline" size={18} color={palette.success} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDismiss(item.text)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss suggestion: ${item.text}`}
              >
                <Ionicons name="close" size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 220,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  scrollArea: {
    flexGrow: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  suggestionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestionTextArea: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionReason: {
    fontSize: 11,
    marginTop: 1,
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
});
