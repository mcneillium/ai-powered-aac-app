// src/screens/AACBoardScreen.js
// The primary AAC communication screen.
//
// Design principles:
// 1. OFFLINE-FIRST: Works without internet using local core vocabulary
// 2. MOTOR-PLAN STABLE: Button positions never change unless user explicitly edits
// 3. ACCESSIBLE: Every button has proper accessibility labels and roles
// 4. LOW-LATENCY: Speech fires immediately on tap with no network dependency
// 5. Fitzgerald Key color coding for part-of-speech awareness

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { speak, stop } from '../services/speechService';
import { getHomePage, getPage } from '../data/coreVocabulary';
import { recordWordSelection, recordSentenceSpoken } from '../services/aiProfileStore';

export default function AACBoardScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const [sentenceWords, setSentenceWords] = useState([]);
  const [currentPageId, setCurrentPageId] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);

  const currentPage = getPage(currentPageId) || getHomePage();

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
  const addWord = useCallback((button) => {
    setSentenceWords(prev => {
      const next = [...prev, button.label];
      // Record for AI personalization (non-blocking)
      recordWordSelection(button.label, prev).catch(() => {});
      // Announce to screen reader
      AccessibilityInfo.announceForAccessibility(`Added ${button.label}. Sentence: ${next.join(' ')}`);
      return next;
    });
    // Speak the individual word immediately for feedback
    speak(button.label, {
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
      addWord(button);
    }
  }, [navigateToPage, addWord]);

  // Speak the full sentence
  const speakSentence = useCallback(() => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      speak(text, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        voice: settings.speechVoice,
      });
      // Record for AI phrase learning (non-blocking)
      recordSentenceSpoken(sentenceWords).catch(() => {});
    }
  }, [sentenceWords, settings]);

  // Remove last word (backspace)
  const removeLastWord = useCallback(() => {
    setSentenceWords(prev => {
      const next = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      AccessibilityInfo.announceForAccessibility(
        next.length > 0
          ? `Removed ${removed}. Sentence: ${next.join(' ')}`
          : 'Sentence cleared'
      );
      return next;
    });
  }, []);

  // Clear entire sentence
  const clearSentence = useCallback(() => {
    setSentenceWords([]);
    stop();
    AccessibilityInfo.announceForAccessibility('Sentence cleared');
  }, []);

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
        style={[styles.sentenceBar, { backgroundColor: palette.surface, borderColor: palette.border }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          sentenceWords.length > 0
            ? `Sentence: ${sentenceWords.join(' ')}`
            : 'Sentence bar is empty. Tap words below to build a sentence.'
        }
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
            onPress={removeLastWord}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Delete last word"
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="backspace-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearSentence}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Clear sentence"
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={speakSentence}
            style={[styles.speakBtn, { backgroundColor: palette.primary }]}
            accessibilityRole="button"
            accessibilityLabel={`Speak sentence: ${sentenceWords.join(' ')}`}
            accessibilityHint="Reads your sentence aloud"
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="volume-high" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

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
    minWidth: 44,
    minHeight: 44,
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
    minWidth: 60, // WCAG: minimum 44pt touch target (60 > 44 after margin)
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
