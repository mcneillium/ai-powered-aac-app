// src/screens/AACBoardScreen.js
// The primary AAC communication screen.
//
// Design principles:
// 1. OFFLINE-FIRST: Works without internet using local core vocabulary
// 2. MOTOR-PLAN STABLE: Button positions never change unless user explicitly edits
// 3. ACCESSIBLE: Every button has proper accessibility labels and roles
// 4. LOW-LATENCY: Speech fires immediately on tap with no network dependency
// 5. Fitzgerald Key color coding for part-of-speech awareness
// 6. AI suggestions strip shows contextual next-word predictions

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { speak, stop } from '../services/speechService';
import { getHomePage, getPage } from '../data/coreVocabulary';
import { getAISuggestions } from '../services/getAISuggestions';
import {
  recordWordSelection,
  recordSentenceSpoken,
  recordSuggestionsShown,
  getBigramPredictions,
  getTopWords,
} from '../services/aiProfileStore';

// Sentence history stored in memory (survives navigation but not app restart)
let sentenceHistory = [];
const MAX_HISTORY = 20;

export default function AACBoardScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const [sentenceWords, setSentenceWords] = useState([]);
  const [currentPageId, setCurrentPageId] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const sentenceBarRef = useRef(null);

  const currentPage = getPage(currentPageId) || getHomePage();

  // Fetch AI suggestions when sentence changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sentenceWords.length === 0) {
        // Show user's top words when sentence is empty
        const top = getTopWords(6);
        if (!cancelled) setSuggestions(top.length > 0 ? top : []);
        return;
      }

      // Try bigram predictions first (instant, local)
      const lastWord = sentenceWords[sentenceWords.length - 1];
      const bigramResults = getBigramPredictions(lastWord, 4);
      if (bigramResults.length > 0 && !cancelled) {
        setSuggestions(bigramResults);
      }

      // Then try the neural model (async)
      try {
        const text = sentenceWords.join(' ');
        const aiResults = await getAISuggestions(text);
        if (!cancelled && aiResults.length > 0) {
          // Merge: bigram results first (user-personalized), then AI model results
          const merged = [...new Set([...bigramResults, ...aiResults])].slice(0, 6);
          setSuggestions(merged);
          recordSuggestionsShown(merged.length).catch(() => {});
        }
      } catch {
        // Bigram results are already showing — this is fine
      }
    })();
    return () => { cancelled = true; };
  }, [sentenceWords]);

  // Navigate to a sub-page (e.g., Food, People)
  const navigateToPage = useCallback((pageId) => {
    setPageHistory(prev => [...prev, currentPageId]);
    setCurrentPageId(pageId);
  }, [currentPageId]);

  // Go back to previous page
  const goBack = useCallback(() => {
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1];
      setPageHistory(h => h.slice(0, -1));
      setCurrentPageId(prev);
    }
  }, [pageHistory]);

  // Go home
  const goHome = useCallback(() => {
    setPageHistory([]);
    setCurrentPageId('home');
  }, []);

  // Add word to sentence bar
  const addWord = useCallback((label, wasSuggestion = false) => {
    setSentenceWords(prev => {
      const next = [...prev, label];
      // Record for AI profile learning
      recordWordSelection(label, prev, wasSuggestion).catch(() => {});
      return next;
    });
    // Speak the individual word immediately for feedback
    speak(label, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
  }, [settings]);

  // Handle button tap — either navigate or add word
  const handleButtonPress = useCallback((button) => {
    if (button.navigateTo) {
      navigateToPage(button.navigateTo);
    } else {
      addWord(button.label);
    }
  }, [navigateToPage, addWord]);

  // Handle AI suggestion tap
  const handleSuggestionPress = useCallback((word) => {
    addWord(word, true);
  }, [addWord]);

  // Speak the full sentence
  const speakSentence = useCallback(() => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      speak(text, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        voice: settings.speechVoice,
      });
      // Record in profile and save to history
      recordSentenceSpoken(sentenceWords).catch(() => {});
      sentenceHistory.unshift({ text, timestamp: Date.now() });
      if (sentenceHistory.length > MAX_HISTORY) sentenceHistory.pop();
    }
  }, [sentenceWords, settings]);

  // Remove last word (backspace)
  const removeLastWord = useCallback(() => {
    setSentenceWords(prev => prev.slice(0, -1));
  }, []);

  // Clear entire sentence
  const clearSentence = useCallback(() => {
    setSentenceWords([]);
    stop();
  }, []);

  // Repeat a sentence from history
  const repeatFromHistory = useCallback((text) => {
    const words = text.split(' ');
    setSentenceWords(words);
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    setShowHistory(false);
  }, [settings]);

  const numColumns = settings.gridSize || 4;

  const renderButton = useCallback(({ item }) => {
    const isNavButton = !!item.navigateTo;
    const buttonColor = settings.theme === 'highContrast'
      ? palette.cardBg
      : item.color;
    const buttonTextColor = settings.theme === 'highContrast'
      ? palette.text
      : item.textColor;

    return (
      <TouchableOpacity
        style={[
          styles.vocabButton,
          {
            backgroundColor: buttonColor,
            borderColor: settings.theme === 'highContrast' ? palette.border : '#DDD',
            flex: 1 / numColumns,
          },
        ]}
        onPress={() => handleButtonPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isNavButton
            ? `Go to ${item.label} page`
            : `Say ${item.label}. ${item.category}`
        }
        accessibilityHint={
          isNavButton
            ? 'Opens a new vocabulary page'
            : 'Adds this word to your sentence'
        }
      >
        {item.icon && (
          <Ionicons
            name={item.icon}
            size={20}
            color={buttonTextColor}
            style={styles.buttonIcon}
          />
        )}
        <Text
          style={[
            styles.buttonLabel,
            { color: buttonTextColor },
            numColumns >= 4 && styles.buttonLabelSmall,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [handleButtonPress, numColumns, palette, settings.theme]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence bar — shows accumulated words */}
      <View
        ref={sentenceBarRef}
        style={[styles.sentenceBar, { backgroundColor: palette.surface, borderColor: palette.border }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          sentenceWords.length > 0
            ? `Sentence: ${sentenceWords.join(' ')}`
            : 'Sentence bar is empty. Tap words below to build a sentence.'
        }
        accessibilityLiveRegion="polite"
      >
        <View style={styles.sentenceWords}>
          {sentenceWords.length === 0 ? (
            <Text style={[styles.placeholder, { color: palette.textSecondary }]}>
              Tap words to build a sentence
            </Text>
          ) : (
            sentenceWords.map((word, i) => (
              <Text key={`${i}-${word}`} style={[styles.sentenceWord, { color: palette.text }]}>
                {word}
              </Text>
            ))
          )}
        </View>

        <View style={styles.sentenceActions}>
          <TouchableOpacity
            onPress={() => setShowHistory(h => !h)}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.info }]}
            accessibilityRole="button"
            accessibilityLabel={showHistory ? 'Hide sentence history' : 'Show sentence history'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeLastWord}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Delete last word"
            disabled={sentenceWords.length === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="backspace-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearSentence}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Clear sentence"
            disabled={sentenceWords.length === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={speakSentence}
            style={[styles.speakBtn, { backgroundColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel={
              sentenceWords.length > 0
                ? `Speak sentence: ${sentenceWords.join(' ')}`
                : 'Speak button. Build a sentence first.'
            }
            accessibilityHint="Reads your sentence aloud"
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="volume-high" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sentence history dropdown */}
      {showHistory && sentenceHistory.length > 0 && (
        <View style={[styles.historyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>Recent Sentences</Text>
          {sentenceHistory.slice(0, 5).map((item, i) => (
            <TouchableOpacity
              key={`${i}-${item.timestamp}`}
              style={[styles.historyItem, { borderBottomColor: palette.border }]}
              onPress={() => repeatFromHistory(item.text)}
              accessibilityRole="button"
              accessibilityLabel={`Repeat: ${item.text}`}
            >
              <Ionicons name="refresh-outline" size={16} color={palette.primary} />
              <Text style={[styles.historyText, { color: palette.text }]} numberOfLines={1}>
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* AI Suggestions strip */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsBar, { backgroundColor: palette.surface }]}>
          <Ionicons name="sparkles-outline" size={16} color={palette.textSecondary} style={{ marginRight: 4 }} />
          <FlatList
            data={suggestions}
            horizontal
            keyExtractor={(item, i) => `${item}-${i}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionChip, { backgroundColor: palette.chipBg, borderColor: palette.border }]}
                onPress={() => handleSuggestionPress(item)}
                accessibilityRole="button"
                accessibilityLabel={`Suggestion: ${item}`}
                accessibilityHint="Add this word to your sentence"
              >
                <Text style={[styles.suggestionText, { color: palette.text }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Navigation breadcrumb */}
      {currentPageId !== 'home' && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity
            onPress={goHome}
            style={[styles.breadcrumbBtn, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Go to home page"
          >
            <Ionicons name="home-outline" size={18} color={palette.text} />
            <Text style={[styles.breadcrumbText, { color: palette.text }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goBack}
            style={[styles.breadcrumbBtn, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={palette.text} />
            <Text style={[styles.breadcrumbText, { color: palette.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: palette.text }]}>
            {currentPage.label}
          </Text>
        </View>
      )}

      {/* Vocabulary grid */}
      <FlatList
        data={currentPage.buttons}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        contentContainerStyle={styles.grid}
        renderItem={renderButton}
        getItemLayout={(data, index) => ({
          length: 90,
          offset: 90 * Math.floor(index / numColumns),
          index,
        })}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sentenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    minHeight: 60,
  },
  sentenceWords: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sentenceWord: {
    fontSize: 20,
    fontWeight: '500',
    marginRight: 6,
    paddingVertical: 2,
  },
  placeholder: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  sentenceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sentenceActionBtn: {
    padding: 8,
    borderRadius: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakBtn: {
    padding: 10,
    borderRadius: 8,
    minWidth: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  historyText: {
    fontSize: 15,
    flex: 1,
  },
  suggestionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  breadcrumbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  grid: {
    padding: 4,
    paddingBottom: 80, // space for tab bar
  },
  vocabButton: {
    margin: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 8,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginBottom: 2,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonLabelSmall: {
    fontSize: 13,
  },
});
