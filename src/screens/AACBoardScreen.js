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
// 7. Favourites: Users can pin frequently-used phrases
// 8. Persistent history: Sentence history survives app restarts

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
  scoreByFrequencyAndRecency,
} from '../services/aiProfileStore';
import {
  loadSentenceHistory,
  getSentenceHistory,
  addSentenceToHistory,
  incrementSpeakCount,
} from '../services/sentenceHistoryStore';
import {
  loadFavourites,
  getFavourites,
  addFavourite,
  removeFavourite,
  isFavourite,
} from '../services/favouritesStore';
import { getAACPhraseSuggestions } from '../services/vertexAISuggestions';
import DisplayMode from '../components/DisplayMode';
import VoicePresetPicker from '../components/VoicePresetPicker';
import { applyPreset } from '../services/speechService';

export default function AACBoardScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const navigation = useNavigation();

  const [sentenceWords, setSentenceWords] = useState([]);
  const [currentPageId, setCurrentPageId] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [history, setHistory] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [voicePreset, setVoicePreset] = useState('normal');
  const [displayMode, setDisplayMode] = useState(null); // null | 'display' | 'listener'
  const [lastSpoken, setLastSpoken] = useState('');
  const sentenceBarRef = useRef(null);

  const currentPage = getPage(currentPageId) || getHomePage();
  const aiEnabled = settings.aiPersonalisationEnabled !== false;

  // Load persistent data on mount
  useEffect(() => {
    loadSentenceHistory().then(setHistory);
    loadFavourites().then(setFavourites);
  }, []);

  // Fetch AI suggestions when sentence changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sentenceWords.length === 0) {
        if (aiEnabled) {
          const top = getTopWords(6);
          if (!cancelled) setSuggestions(top.length > 0 ? top : []);
        } else {
          setSuggestions([]);
        }
        return;
      }

      // Try bigram predictions first (instant, local, personalised)
      const lastWord = sentenceWords[sentenceWords.length - 1];
      const bigramResults = aiEnabled ? getBigramPredictions(lastWord, 4) : [];
      if (bigramResults.length > 0 && !cancelled) {
        setSuggestions(bigramResults);
      }

      // Then try the neural model (async)
      try {
        const text = sentenceWords.join(' ');
        const aiResults = await getAISuggestions(text);
        if (!cancelled && aiResults.length > 0) {
          const merged = [...new Set([...bigramResults, ...aiResults])].slice(0, 6);
          const ranked = aiEnabled
            ? scoreByFrequencyAndRecency(merged).map(s => s.word)
            : merged;
          setSuggestions(ranked);
          if (aiEnabled) recordSuggestionsShown(ranked.length).catch(() => {});
        }
      } catch {
        // Bigram results are already showing
      }

      // Also try Vertex AI for richer phrase suggestions (async, non-blocking)
      if (aiEnabled && sentenceWords.length >= 2) {
        try {
          const recentTexts = getSentenceHistory().slice(0, 3).map(h => h.text);
          const vertexPhrases = await getAACPhraseSuggestions(sentenceWords, recentTexts);
          if (!cancelled && vertexPhrases.length > 0) {
            // Append Vertex suggestions after local ones
            setSuggestions(prev => {
              const all = [...new Set([...prev, ...vertexPhrases])];
              return all.slice(0, 8);
            });
          }
        } catch {
          // Vertex AI is optional — local suggestions still work
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sentenceWords, aiEnabled]);

  const navigateToPage = useCallback((pageId) => {
    setPageHistory(prev => [...prev, currentPageId]);
    setCurrentPageId(pageId);
  }, [currentPageId]);

  const goBack = useCallback(() => {
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1];
      setPageHistory(h => h.slice(0, -1));
      setCurrentPageId(prev);
    }
  }, [pageHistory]);

  const goHome = useCallback(() => {
    setPageHistory([]);
    setCurrentPageId('home');
  }, []);

  const addWord = useCallback((label, wasSuggestion = false) => {
    setSentenceWords(prev => {
      const next = [...prev, label];
      if (aiEnabled) {
        recordWordSelection(label, prev, wasSuggestion).catch(() => {});
      }
      return next;
    });
    speak(label, applyPreset(voicePreset, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    }));
  }, [settings, aiEnabled, voicePreset]);

  const handleButtonPress = useCallback((button) => {
    if (button.navigateTo) {
      navigateToPage(button.navigateTo);
    } else {
      addWord(button.label);
    }
  }, [navigateToPage, addWord]);

  const handleSuggestionPress = useCallback((word) => {
    // If suggestion is a multi-word phrase, add all words
    const words = word.split(' ');
    if (words.length > 1) {
      setSentenceWords(prev => [...prev, ...words]);
      speak(word, applyPreset(voicePreset, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice }));
    } else {
      addWord(word, true);
    }
  }, [addWord, settings]);

  const speakSentence = useCallback(async () => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      speak(text, applyPreset(voicePreset, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        voice: settings.speechVoice,
      }));
      setLastSpoken(text);
      if (aiEnabled) recordSentenceSpoken(sentenceWords).catch(() => {});

      await addSentenceToHistory(text);
      setHistory(getSentenceHistory());
    }
  }, [sentenceWords, settings, aiEnabled, voicePreset]);

  const removeLastWord = useCallback(() => {
    setSentenceWords(prev => prev.slice(0, -1));
  }, []);

  const clearSentence = useCallback(() => {
    setSentenceWords([]);
    stop();
  }, []);

  const repeatFromHistory = useCallback((text) => {
    const words = text.split(' ');
    setSentenceWords(words);
    speak(text, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    });
    incrementSpeakCount(text).catch(() => {});
    setShowHistory(false);
  }, [settings]);

  const handleToggleFavourite = useCallback(async () => {
    const text = sentenceWords.join(' ').trim();
    if (!text) return;

    if (isFavourite(text)) {
      const fav = getFavourites().find(f => f.phrase === text);
      if (fav) await removeFavourite(fav.id);
    } else {
      await addFavourite(text);
    }
    setFavourites([...getFavourites()]);
  }, [sentenceWords]);

  const speakFavourite = useCallback((phrase) => {
    const words = phrase.split(' ');
    setSentenceWords(words);
    speak(phrase, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });
    setShowFavourites(false);
  }, [settings]);

  const numColumns = settings.gridSize || 4;
  const currentSentenceText = sentenceWords.join(' ').trim();
  const isCurrentFavourite = currentSentenceText ? isFavourite(currentSentenceText) : false;

  const renderButton = useCallback(({ item }) => {
    const isNavButton = !!item.navigateTo;
    const buttonColor = settings.theme === 'highContrast' ? palette.cardBg : item.color;
    const buttonTextColor = settings.theme === 'highContrast' ? palette.text : item.textColor;

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
          isNavButton ? `Go to ${item.label} page` : `Say ${item.label}. ${item.category}`
        }
        accessibilityHint={
          isNavButton ? 'Opens a new vocabulary page' : 'Adds this word to your sentence'
        }
      >
        {item.icon && (
          <Ionicons name={item.icon} size={20} color={buttonTextColor} style={styles.buttonIcon} />
        )}
        <Text
          style={[styles.buttonLabel, { color: buttonTextColor }, numColumns >= 4 && styles.buttonLabelSmall]}
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
      {/* Sentence bar */}
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
          {/* Camera */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Camera')}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Open camera to describe what you see"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="camera-outline" size={20} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Favourites toggle */}
          <TouchableOpacity
            onPress={() => { setShowFavourites(f => !f); setShowHistory(false); }}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.warning }]}
            accessibilityRole="button"
            accessibilityLabel={showFavourites ? 'Hide favourites' : 'Show favourites'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="star" size={20} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Star/unstar current sentence */}
          {sentenceWords.length > 0 && (
            <TouchableOpacity
              onPress={handleToggleFavourite}
              style={[styles.sentenceActionBtn, { backgroundColor: isCurrentFavourite ? palette.warning : palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={isCurrentFavourite ? 'Remove from favourites' : 'Add to favourites'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={isCurrentFavourite ? 'star' : 'star-outline'} size={18} color={isCurrentFavourite ? palette.buttonText : palette.text} />
            </TouchableOpacity>
          )}
          {/* History */}
          <TouchableOpacity
            onPress={() => { setShowHistory(h => !h); setShowFavourites(false); }}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.info }]}
            accessibilityRole="button"
            accessibilityLabel={showHistory ? 'Hide sentence history' : 'Show sentence history'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={20} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Backspace */}
          <TouchableOpacity
            onPress={removeLastWord}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Delete last word"
            disabled={sentenceWords.length === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="backspace-outline" size={22} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Clear */}
          <TouchableOpacity
            onPress={clearSentence}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Clear sentence"
            disabled={sentenceWords.length === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={22} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Speak */}
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
            <Ionicons name="volume-high" size={26} color={palette.buttonText} />
          </TouchableOpacity>
          {/* Display mode: show sentence large for partner */}
          <TouchableOpacity
            onPress={() => setDisplayMode('display')}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.chipBg }]}
            accessibilityRole="button"
            accessibilityLabel="Show sentence on full screen for your conversation partner"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="tv-outline" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Voice preset picker */}
      <VoicePresetPicker activePreset={voicePreset} onSelect={setVoicePreset} />

      {/* Display mode overlay */}
      <DisplayMode
        visible={displayMode === 'display'}
        onClose={() => setDisplayMode(null)}
        text={sentenceWords.join(' ')}
        mode="display"
      />
      <DisplayMode
        visible={displayMode === 'listener'}
        onClose={() => setDisplayMode(null)}
        text={lastSpoken}
        mode="listener"
      />

      {/* Favourites panel */}
      {showFavourites && (
        <View style={[styles.historyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>Favourites</Text>
          {favourites.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No favourites yet. Build a sentence and tap the star to save it.
            </Text>
          ) : (
            favourites.slice(0, 8).map((fav) => (
              <TouchableOpacity
                key={fav.id}
                style={[styles.historyItem, { borderBottomColor: palette.border }]}
                onPress={() => speakFavourite(fav.phrase)}
                accessibilityRole="button"
                accessibilityLabel={`Speak favourite: ${fav.phrase}`}
              >
                <Ionicons name="star" size={16} color={palette.warning} />
                <Text style={[styles.historyText, { color: palette.text }]} numberOfLines={1}>
                  {fav.phrase}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Sentence history dropdown */}
      {showHistory && (
        <View style={[styles.historyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>Recent Sentences</Text>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No history yet. Speak a sentence to save it here.
            </Text>
          ) : (
            history.slice(0, 8).map((item, i) => (
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
                {(item.speakCount || 0) > 1 && (
                  <Text style={[styles.speakCount, { color: palette.textSecondary }]}>
                    {item.speakCount}x
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
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
  container: { flex: 1 },
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
  sentenceWord: { fontSize: 20, fontWeight: '500', marginRight: 6, paddingVertical: 2 },
  placeholder: { fontSize: 16, fontStyle: 'italic' },
  sentenceActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sentenceActionBtn: {
    padding: 7,
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
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
  historyPanel: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
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
  historyText: { fontSize: 15, flex: 1 },
  speakCount: { fontSize: 12, fontWeight: '500' },
  emptyText: { fontSize: 14, fontStyle: 'italic', paddingVertical: 4 },
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
  suggestionText: { fontSize: 15, fontWeight: '500' },
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
  breadcrumbText: { fontSize: 14, fontWeight: '500' },
  pageTitle: { fontSize: 16, fontWeight: '600', marginLeft: 4 },
  grid: { padding: 4, paddingBottom: 80 },
  vocabButton: {
    margin: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 8,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: { marginBottom: 2 },
  buttonLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  buttonLabelSmall: { fontSize: 13 },
});
