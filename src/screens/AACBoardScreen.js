// src/screens/AACBoardScreen.js
// Primary AAC communication screen with symbol-backed word grid.
//
// Each word cell shows: pictogram (top 60%) + label (bottom 40%).
// Tap animation: brief scale pulse (1.0 → 1.1 → 1.0 over 150ms).
// Haptic feedback on every tap for tactile confirmation.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, CATEGORY_COLORS, spacing, radii } from '../theme';
import { speak, stop } from '../services/speechService';
import { getHomePage, getPage } from '../data/coreVocabulary';
import { getAISuggestions } from '../services/getAISuggestions';
import { useOnDevicePrediction } from '../hooks/useOnDevicePrediction';
import { t } from '../i18n/strings';
import {
  recordWordSelection, recordSentenceSpoken, recordSuggestionsShown,
  getBigramPredictions, getTopWords, scoreWithExplanation,
  recordSuggestionAccepted, recordSourceShown,
} from '../services/aiProfileStore';
import {
  loadSentenceHistory, getSentenceHistory, addSentenceToHistory, incrementSpeakCount,
} from '../services/sentenceHistoryStore';
import {
  loadFavourites, getFavourites, addFavourite, removeFavourite, isFavourite,
} from '../services/favouritesStore';
import { getAACPhraseSuggestions } from '../services/vertexAISuggestions';
import { getContextSuggestions } from '../services/contextAgent';
import { checkPhraseDistress, recordActivity } from '../services/caregiverAlerts';
import DisplayMode from '../components/DisplayMode';
import SmartSuggestionsPanel from '../components/SmartSuggestionsPanel';
import VoicePresetPicker from '../components/VoicePresetPicker';
import SymbolImage from '../components/SymbolImage';
import { addCustomVocabItem } from '../services/customVocabStore';
import { applyPreset } from '../services/speechService';
import {
  setScanItems, setScanMode, setScanSpeed,
  onScanChange, onScanSelect, startScan, stopScan,
  cleanup as cleanupScan,
} from '../services/switchScanService';

function getCategoryBorderColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.misc;
}

function AnimatedWordCell({ item, numColumns, palette, settings, onPress, scanFocused }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isNavButton = !!item.navigateTo;
  const buttonColor = settings.theme === 'highContrast' ? palette.cardBg : (item.color || '#FFFFFF');
  const buttonTextColor = settings.theme === 'highContrast' ? palette.text : (item.textColor || '#000');
  const borderColor = getCategoryBorderColor(item.category);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 75, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 75, useNativeDriver: true }),
    ]).start();
    onPress(item);
  };

  return (
    <Animated.View style={[{ flex: 1 / numColumns, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.vocabButton,
          {
            backgroundColor: buttonColor,
            borderColor: borderColor,
          },
          scanFocused && styles.scanFocused,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isNavButton ? `Go to ${item.label} page` : `Say ${item.label}`}
        accessibilityHint={isNavButton ? 'Opens a new vocabulary page' : 'Adds this word to your sentence'}
      >
        <View style={styles.symbolArea}>
          {isNavButton && item.icon ? (
            <Ionicons name={item.icon} size={32} color={buttonTextColor} />
          ) : (
            <SymbolImage word={item.label} size={40} fallbackLabel={item.label} />
          )}
        </View>
        <Text
          style={[styles.buttonLabel, { color: buttonTextColor }, numColumns >= 4 && styles.buttonLabelSmall]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SentenceWordTile({ word, index, onRemove, palette }) {
  return (
    <TouchableOpacity
      style={[styles.sentenceTile, { backgroundColor: palette.chipBg, borderColor: palette.border }]}
      onPress={() => onRemove(index)}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${word}`}
    >
      <SymbolImage word={word} size={28} fallbackLabel={word} />
      <Text style={[styles.sentenceTileText, { color: palette.text }]} numberOfLines={1}>{word}</Text>
    </TouchableOpacity>
  );
}

export default function AACBoardScreen() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const navigation = useNavigation();
  const { predictNext: personalPredict, recordTap } = useOnDevicePrediction();

  const [sentenceWords, setSentenceWords] = useState([]);
  const [currentPageId, setCurrentPageId] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [showSmart, setShowSmart] = useState(false);
  const [history, setHistory] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [voicePreset, setVoicePreset] = useState('normal');
  const [displayMode, setDisplayMode] = useState(null);
  const [lastSpoken, setLastSpoken] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanFocusIndex, setScanFocusIndex] = useState(-1);

  const currentPage = getPage(currentPageId) || getHomePage();
  const aiEnabled = settings.aiPersonalisationEnabled !== false;

  useEffect(() => {
    loadSentenceHistory().then(setHistory);
    loadFavourites().then(setFavourites);
  }, []);

  // ── Switch scanning ──
  const scanItemList = useRef([]);
  const speakRef = useRef(null);
  const backspaceRef = useRef(null);
  const clearRef = useRef(null);
  const buttonPressRef = useRef(null);
  const suggestionPressRef = useRef(null);

  useEffect(() => {
    const vocabItems = currentPage.buttons.map(b => ({ type: 'vocab', id: b.id, button: b, label: b.label }));
    const suggItems = suggestions.map((s, i) => ({ type: 'suggestion', id: `sug-${i}`, word: typeof s === 'string' ? s : s.word, label: typeof s === 'string' ? s : s.word }));
    const actionItems = [
      { type: 'action', id: 'speak', label: 'Speak' },
      { type: 'action', id: 'backspace', label: 'Delete' },
      { type: 'action', id: 'clear', label: 'Clear' },
    ];
    scanItemList.current = [...vocabItems, ...suggItems, ...actionItems];
    if (scanActive) setScanItems(scanItemList.current);
  }, [currentPage, suggestions, scanActive]);

  useEffect(() => {
    onScanChange(({ currentIndex, isRunning }) => setScanFocusIndex(isRunning ? currentIndex : -1));
    onScanSelect(({ item }) => {
      if (!item) return;
      if (item.type === 'action') {
        if (item.id === 'speak') speakRef.current?.();
        else if (item.id === 'backspace') backspaceRef.current?.();
        else if (item.id === 'clear') clearRef.current?.();
      } else if (item.type === 'vocab') {
        buttonPressRef.current?.(item.button);
      } else if (item.type === 'suggestion') {
        suggestionPressRef.current?.(item.word);
      }
    });
    return () => cleanupScan();
  }, []);

  useEffect(() => {
    if (settings.scanMode) setScanMode(settings.scanMode);
    if (settings.scanSpeed) setScanSpeed(settings.scanSpeed);
  }, []);

  // ── AI suggestions ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sentenceWords.length === 0) {
        if (aiEnabled) {
          const ctxSuggestions = getContextSuggestions([], { maxSuggestions: 4 });
          const top = getTopWords(6);
          const topSuggestions = top.map(w => ({ word: w, reason: 'used often' }));
          const merged = [...ctxSuggestions, ...topSuggestions.filter(t2 => !ctxSuggestions.find(c => c.word === t2.word))].slice(0, 8);
          if (!cancelled) setSuggestions(merged.length > 0 ? merged : []);
        } else {
          setSuggestions([]);
        }
        return;
      }

      const lastWord = sentenceWords[sentenceWords.length - 1];
      const bigramResults = aiEnabled ? getBigramPredictions(lastWord, 4) : [];
      if (bigramResults.length > 0 && !cancelled) {
        if (aiEnabled) recordSourceShown('bigram', bigramResults.length);
        const scored = scoreWithExplanation(bigramResults);
        setSuggestions(scored.map(s => ({ word: s.word, reason: s.reason })));
      }

      let personalResults = [];
      try {
        personalResults = await personalPredict(sentenceWords, 4);
        if (!cancelled && personalResults.length > 0) {
          const combined = [...new Set([...bigramResults, ...personalResults])];
          const scored = scoreWithExplanation(combined);
          const bigramSet = new Set(bigramResults);
          const labeled = scored.map(s => ({
            word: s.word,
            reason: !bigramSet.has(s.word) && personalResults.includes(s.word) ? 'learned' : s.reason,
          }));
          setSuggestions(labeled.slice(0, 6));
        }
      } catch {}

      try {
        const text = sentenceWords.join(' ');
        const aiResults = await getAISuggestions(text);
        if (!cancelled && aiResults.length > 0) {
          if (aiEnabled) recordSourceShown('neural', aiResults.length);
          const allLocal = [...new Set([...bigramResults, ...personalResults, ...aiResults])].slice(0, 6);
          const scored = aiEnabled ? scoreWithExplanation(allLocal) : allLocal.map(w => ({ word: w, score: 0, reason: 'suggested' }));
          setSuggestions(scored.map(s => ({ word: s.word, reason: s.reason })));
          if (aiEnabled) recordSuggestionsShown(scored.length).catch(() => {});
        }
      } catch {}

      if (aiEnabled && sentenceWords.length >= 2) {
        try {
          await new Promise(r => setTimeout(r, 500));
          if (cancelled) return;
          const recentTexts = getSentenceHistory().slice(0, 3).map(h => h.text);
          const vertexPhrases = await getAACPhraseSuggestions(sentenceWords, recentTexts);
          if (!cancelled && vertexPhrases.length > 0) {
            if (aiEnabled) recordSourceShown('vertex', vertexPhrases.length);
            setSuggestions(prev => {
              const existingWords = prev.map(s => typeof s === 'string' ? s : s.word);
              const newPhrases = vertexPhrases.filter(p => !existingWords.includes(p)).map(p => ({ word: p, reason: 'AI suggested' }));
              return [...prev, ...newPhrases].slice(0, 8);
            });
          }
        } catch {}
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
        recordTap(prev, label).catch(() => {});
      }
      return next;
    });
    speak(label, applyPreset(voicePreset, {
      rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice, language: settings.communicationLanguage,
    }));
  }, [settings, aiEnabled, voicePreset, recordTap]);

  const handleButtonPress = useCallback((button) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (button.navigateTo) {
      navigateToPage(button.navigateTo);
    } else if (button.multiWord) {
      const words = button.label.split(' ');
      setSentenceWords(prev => [...prev, ...words]);
      speak(button.label, applyPreset(voicePreset, {
        rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice, language: settings.communicationLanguage,
      }));
    } else {
      addWord(button.label);
    }
  }, [navigateToPage, addWord, settings, voicePreset]);

  const handleSuggestionPress = useCallback((word) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (aiEnabled) {
      const match = suggestions.find(s => (typeof s === 'string' ? s : s.word) === word);
      const reason = match?.reason || '';
      const source = reason === 'AI suggested' ? 'vertex' : reason === 'learned' ? 'neural'
        : ['used recently', 'used today', 'used often', 'used before'].includes(reason) ? 'bigram' : 'frequency';
      recordSuggestionAccepted(source).catch(() => {});
    }
    const words = word.split(' ');
    if (words.length > 1) {
      setSentenceWords(prev => [...prev, ...words]);
      speak(word, applyPreset(voicePreset, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice }));
    } else {
      addWord(word, true);
    }
  }, [addWord, settings, aiEnabled, suggestions, voicePreset]);

  const speakSentence = useCallback(async () => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      speak(text, applyPreset(voicePreset, {
        rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice, language: settings.communicationLanguage,
      }));
      setLastSpoken(text);
      if (aiEnabled) recordSentenceSpoken(sentenceWords).catch(() => {});
      recordActivity().catch(() => {});
      checkPhraseDistress(text);
      await addSentenceToHistory(text);
      setHistory(getSentenceHistory());
    }
  }, [sentenceWords, settings, aiEnabled, voicePreset]);

  const removeLastWord = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSentenceWords(prev => prev.slice(0, -1));
  }, []);

  const removeWordAt = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSentenceWords(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearSentence = useCallback(() => {
    setSentenceWords([]);
    stop();
  }, []);

  // Keep refs updated for scan callbacks
  useEffect(() => { speakRef.current = speakSentence; }, [speakSentence]);
  useEffect(() => { backspaceRef.current = removeLastWord; }, [removeLastWord]);
  useEffect(() => { clearRef.current = clearSentence; }, [clearSentence]);
  useEffect(() => { buttonPressRef.current = handleButtonPress; }, [handleButtonPress]);
  useEffect(() => { suggestionPressRef.current = handleSuggestionPress; }, [handleSuggestionPress]);

  const repeatFromHistory = useCallback((text) => {
    const words = text.split(' ');
    setSentenceWords(words);
    speak(text, { rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice });
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

  const toggleScan = useCallback(() => {
    if (scanActive) { stopScan(); setScanActive(false); }
    else {
      setScanMode(settings.scanMode || 'auto');
      setScanSpeed(settings.scanSpeed || 1500);
      setScanItems(scanItemList.current);
      startScan();
      setScanActive(true);
    }
  }, [scanActive, settings.scanMode, settings.scanSpeed]);

  const isScanFocused = useCallback((type, id) => {
    if (!scanActive || scanFocusIndex < 0) return false;
    const focused = scanItemList.current[scanFocusIndex];
    return focused && focused.type === type && focused.id === id;
  }, [scanActive, scanFocusIndex]);

  const numColumns = settings.gridSize || 4;
  const currentSentenceText = sentenceWords.join(' ').trim();
  const isCurrentFavourite = currentSentenceText ? isFavourite(currentSentenceText) : false;

  const renderButton = useCallback(({ item }) => (
    <AnimatedWordCell
      item={item}
      numColumns={numColumns}
      palette={palette}
      settings={settings}
      onPress={handleButtonPress}
      scanFocused={isScanFocused('vocab', item.id)}
    />
  ), [handleButtonPress, numColumns, palette, settings, isScanFocused]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence bar — picture tiles */}
      <View style={[styles.sentenceBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={clearSentence}
          style={[styles.clearBtn, { backgroundColor: palette.danger }]}
          accessibilityRole="button"
          accessibilityLabel={t('clearSentence')}
          accessibilityHint="Removes all words from the sentence"
          disabled={sentenceWords.length === 0}
        >
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.sentenceTiles}>
          {sentenceWords.length === 0 ? (
            <Text style={[styles.placeholder, { color: palette.textSecondary }]}>{t('tapToSpeak')}</Text>
          ) : (
            sentenceWords.map((word, i) => (
              <SentenceWordTile key={`${i}-${word}`} word={word} index={i} onRemove={removeWordAt} palette={palette} />
            ))
          )}
        </View>
        <TouchableOpacity
          onPress={speakSentence}
          style={[styles.speakBtn, { backgroundColor: palette.primary }, isScanFocused('action', 'speak') && styles.scanFocused]}
          accessibilityRole="button"
          accessibilityLabel={sentenceWords.length > 0 ? `Speak: ${sentenceWords.join(' ')}` : 'Build a sentence first'}
          accessibilityHint="Reads aloud the words you selected"
          disabled={sentenceWords.length === 0}
        >
          <Ionicons name="volume-high" size={28} color={palette.buttonText} />
        </TouchableOpacity>
      </View>

      {/* Quick action row */}
      <View style={[styles.quickActions, { backgroundColor: palette.surface }]}>
        <TouchableOpacity
          onPress={removeLastWord}
          style={[styles.quickBtn, { backgroundColor: palette.danger }, isScanFocused('action', 'backspace') && styles.scanFocused]}
          accessibilityRole="button"
          accessibilityLabel={t('deleteLastWord')}
          disabled={sentenceWords.length === 0}
        >
          <Ionicons name="backspace-outline" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setShowFavourites(f => !f); setShowHistory(false); setShowSmart(false); }}
          style={[styles.quickBtn, { backgroundColor: palette.warning }]}
          accessibilityRole="button"
          accessibilityLabel={showFavourites ? t('hideFavourites') : t('showFavourites')}
        >
          <Ionicons name="star" size={18} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setShowHistory(h => !h); setShowFavourites(false); setShowSmart(false); }}
          style={[styles.quickBtn, { backgroundColor: palette.info }]}
          accessibilityRole="button"
          accessibilityLabel={showHistory ? t('hideHistory') : t('showHistory')}
        >
          <Ionicons name="time-outline" size={18} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setShowSmart(s => !s); setShowFavourites(false); setShowHistory(false); }}
          style={[styles.quickBtn, { backgroundColor: showSmart ? palette.warning : palette.chipBg }]}
          accessibilityRole="button"
          accessibilityLabel={showSmart ? 'Hide smart suggestions' : 'Show smart suggestions'}
        >
          <Ionicons name="bulb-outline" size={18} color={showSmart ? '#FFF' : palette.text} />
        </TouchableOpacity>
        {sentenceWords.length > 0 && (
          <TouchableOpacity
            onPress={handleToggleFavourite}
            style={[styles.quickBtn, { backgroundColor: isCurrentFavourite ? palette.warning : palette.chipBg }]}
            accessibilityRole="button"
            accessibilityLabel={isCurrentFavourite ? t('removeFromFavourites') : t('addToFavourites')}
          >
            <Ionicons name={isCurrentFavourite ? 'star' : 'star-outline'} size={16} color={isCurrentFavourite ? '#FFF' : palette.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={toggleScan}
          style={[styles.quickBtn, { backgroundColor: scanActive ? '#FF6600' : palette.chipBg }]}
          accessibilityRole="button"
          accessibilityLabel={scanActive ? t('stopScanning') : t('startScanning')}
        >
          <Ionicons name={scanActive ? 'stop' : 'scan-outline'} size={16} color={scanActive ? '#FFF' : palette.text} />
        </TouchableOpacity>
      </View>

      {/* Voice preset picker */}
      <VoicePresetPicker activePreset={voicePreset} onSelect={setVoicePreset} />

      {/* Display mode overlays */}
      <DisplayMode visible={displayMode === 'display'} onClose={() => setDisplayMode(null)} text={sentenceWords.join(' ')} mode="display" />
      <DisplayMode visible={displayMode === 'listener'} onClose={() => setDisplayMode(null)} text={lastSpoken} mode="listener" />

      {/* Favourites panel */}
      {showFavourites && (
        <View style={[styles.sidePanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>{t('favourites')}</Text>
          {favourites.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noFavourites')}</Text>
          ) : (
            favourites.slice(0, 8).map((fav) => (
              <TouchableOpacity key={fav.id} style={[styles.panelItem, { borderBottomColor: palette.border }]} onPress={() => speakFavourite(fav.phrase)} accessibilityRole="button" accessibilityLabel={`Speak favourite: ${fav.phrase}`}>
                <Ionicons name="star" size={16} color={palette.warning} />
                <Text style={[styles.panelText, { color: palette.text }]} numberOfLines={1}>{fav.phrase}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* History panel */}
      {showHistory && (
        <View style={[styles.sidePanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.panelTitle, { color: palette.textSecondary }]}>{t('sentenceHistory')}</Text>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noHistory')}</Text>
          ) : (
            history.slice(0, 8).map((item, i) => (
              <TouchableOpacity key={`${i}-${item.timestamp}`} style={[styles.panelItem, { borderBottomColor: palette.border }]} onPress={() => repeatFromHistory(item.text)} accessibilityRole="button" accessibilityLabel={`Repeat: ${item.text}`}>
                <Ionicons name="refresh-outline" size={16} color={palette.primary} />
                <Text style={[styles.panelText, { color: palette.text }]} numberOfLines={1}>{item.text}</Text>
                {(item.speakCount || 0) > 1 && <Text style={[styles.speakCount, { color: palette.textSecondary }]}>{item.speakCount}x</Text>}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Smart suggestions panel */}
      <SmartSuggestionsPanel
        visible={showSmart}
        palette={palette}
        settings={settings}
        onSpeakPhrase={(text) => setSentenceWords(text.split(' '))}
        onAddWord={(word, category) => addCustomVocabItem(word, category || 'noun', 'smart-suggestion').catch(() => {})}
        onCreateQuickPage={(page) => { setShowSmart(false); navigation.navigate('Contexts', { activateQuickPage: page }); }}
        onRefresh={() => setFavourites([...getFavourites()])}
      />

      {/* AI Suggestions strip — pictogram-backed buttons */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <FlatList
            data={suggestions}
            horizontal
            keyExtractor={(item, i) => `${typeof item === 'string' ? item : item.word}-${i}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const word = typeof item === 'string' ? item : item.word;
              const sugFocused = isScanFocused('suggestion', `sug-${index}`);
              return (
                <TouchableOpacity
                  style={[styles.suggestionChip, { backgroundColor: palette.cardBg, borderColor: palette.primary + '44' }, sugFocused && styles.scanFocused]}
                  onPress={() => handleSuggestionPress(word)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggestion: ${word}`}
                  accessibilityHint="Adds this word to your sentence"
                >
                  <SymbolImage word={word} size={28} fallbackLabel={word} />
                  <Text style={[styles.suggestionText, { color: palette.text }]}>{word}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Navigation breadcrumb */}
      {currentPageId !== 'home' && (
        <View style={[styles.breadcrumb, { backgroundColor: palette.surface }]}>
          <TouchableOpacity onPress={goHome} style={[styles.breadcrumbBtn, { backgroundColor: palette.chipBg }]} accessibilityRole="button" accessibilityLabel={t('goHome')}>
            <Ionicons name="home" size={20} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goBack} style={[styles.breadcrumbBtn, { backgroundColor: palette.chipBg }]} accessibilityRole="button" accessibilityLabel={t('goBack')}>
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: palette.text }]}>{currentPage.label}</Text>
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
        extraData={scanFocusIndex}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({ length: 96, offset: 96 * index, index })}
        windowSize={5}
        maxToRenderPerBatch={12}
        initialNumToRender={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sentenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    gap: spacing.sm,
  },
  clearBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentenceTiles: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  sentenceTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 4,
    minHeight: 48,
  },
  sentenceTileText: { fontSize: 14, fontWeight: '600', maxWidth: 80 },
  placeholder: { fontSize: 16, fontStyle: 'italic' },
  speakBtn: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 5,
    flexWrap: 'wrap',
  },
  quickBtn: {
    padding: 7,
    borderRadius: radii.sm,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePanel: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  panelTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  panelItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  panelText: { fontSize: 15, flex: 1 },
  speakCount: { fontSize: 12, fontWeight: '500' },
  emptyText: { fontSize: 14, fontStyle: 'italic', paddingVertical: 4 },
  suggestionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  suggestionChip: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.lg,
    marginRight: 8,
    borderWidth: 2,
    minWidth: 64,
  },
  suggestionText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 8,
  },
  breadcrumbBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
  grid: { padding: 4, paddingBottom: 80 },
  vocabButton: {
    margin: 3,
    borderRadius: radii.lg,
    borderWidth: 3,
    padding: 6,
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  buttonLabelSmall: { fontSize: 12 },
  scanFocused: { borderColor: '#FF6600', borderWidth: 4 },
});
