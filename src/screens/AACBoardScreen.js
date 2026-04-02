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
import { useOnDevicePrediction } from '../hooks/useOnDevicePrediction';
import { t } from '../i18n/strings';
import {
  recordWordSelection,
  recordSentenceSpoken,
  recordSuggestionsShown,
  getBigramPredictions,
  getTopWords,
  scoreWithExplanation,
  recordSuggestionAccepted,
  recordSourceShown,
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
import SmartSuggestionsPanel from '../components/SmartSuggestionsPanel';
import VoicePresetPicker from '../components/VoicePresetPicker';
import { addCustomVocabItem } from '../services/customVocabStore';
import { applyPreset } from '../services/speechService';
import {
  setScanItems, setScanMode, setScanSpeed, getScanState,
  onScanChange, onScanSelect, startScan, stopScan,
  advanceScan, selectCurrent, cleanup as cleanupScan,
} from '../services/switchScanService';

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
  const [displayMode, setDisplayMode] = useState(null); // null | 'display' | 'listener'
  const [lastSpoken, setLastSpoken] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanFocusIndex, setScanFocusIndex] = useState(-1);
  const sentenceBarRef = useRef(null);

  const currentPage = getPage(currentPageId) || getHomePage();
  const aiEnabled = settings.aiPersonalisationEnabled !== false;

  // Load persistent data on mount
  useEffect(() => {
    loadSentenceHistory().then(setHistory);
    loadFavourites().then(setFavourites);
  }, []);

  // ── Switch scanning ──
  // Scan order: vocab grid first (main communication), then suggestions, then actions last.
  // This puts the most-used items at the start of the scan cycle.
  const scanItemList = useRef([]);

  // Use refs for action callbacks to avoid stale closures in scan select handler
  const speakRef = useRef(speakSentence);
  const backspaceRef = useRef(removeLastWord);
  const clearRef = useRef(clearSentence);
  const buttonPressRef = useRef(handleButtonPress);
  const suggestionPressRef = useRef(handleSuggestionPress);
  useEffect(() => { speakRef.current = speakSentence; }, [speakSentence]);
  useEffect(() => { backspaceRef.current = removeLastWord; }, [removeLastWord]);
  useEffect(() => { clearRef.current = clearSentence; }, [clearSentence]);
  useEffect(() => { buttonPressRef.current = handleButtonPress; }, [handleButtonPress]);
  useEffect(() => { suggestionPressRef.current = handleSuggestionPress; }, [handleSuggestionPress]);

  useEffect(() => {
    // Rebuild scan items: vocab → suggestions → actions
    const vocabItems = currentPage.buttons.map(b => ({
      type: 'vocab', id: b.id, button: b, label: b.label,
    }));
    const suggItems = suggestions.map((s, i) => ({
      type: 'suggestion', id: `sug-${i}`, word: typeof s === 'string' ? s : s.word, label: typeof s === 'string' ? s : s.word,
    }));
    const actionItems = [
      { type: 'action', id: 'speak', label: 'Speak' },
      { type: 'action', id: 'backspace', label: 'Delete' },
      { type: 'action', id: 'clear', label: 'Clear' },
    ];
    scanItemList.current = [...vocabItems, ...suggItems, ...actionItems];
    if (scanActive) {
      setScanItems(scanItemList.current);
    }
  }, [currentPage, suggestions, scanActive]);

  // Register scan callbacks once — use refs to avoid stale closures
  useEffect(() => {
    onScanChange(({ currentIndex, isRunning }) => {
      setScanFocusIndex(isRunning ? currentIndex : -1);
    });
    onScanSelect(({ item }) => {
      if (!item) return;
      if (item.type === 'action') {
        if (item.id === 'speak') speakRef.current();
        else if (item.id === 'backspace') backspaceRef.current();
        else if (item.id === 'clear') clearRef.current();
      } else if (item.type === 'vocab') {
        buttonPressRef.current(item.button);
      } else if (item.type === 'suggestion') {
        suggestionPressRef.current(item.word);
      }
    });
    return () => { cleanupScan(); };
  }, []);

  // Initialize scan service from persisted settings
  useEffect(() => {
    if (settings.scanMode) setScanMode(settings.scanMode);
    if (settings.scanSpeed) setScanSpeed(settings.scanSpeed);
  }, []);

  const { updateSettings } = useSettings();

  const toggleScan = useCallback(() => {
    if (scanActive) {
      stopScan();
      setScanActive(false);
    } else {
      setScanMode(settings.scanMode || 'auto');
      setScanSpeed(settings.scanSpeed || 1500);
      setScanItems(scanItemList.current);
      startScan();
      setScanActive(true);
    }
  }, [scanActive, settings.scanMode, settings.scanSpeed]);

  const changeScanMode = useCallback((newMode) => {
    setScanMode(newMode);
    updateSettings({ scanMode: newMode });
    if (scanActive) {
      stopScan();
      setScanItems(scanItemList.current);
      startScan();
    }
  }, [scanActive, updateSettings]);

  const changeScanSpeed = useCallback((delta) => {
    const state = getScanState();
    const newSpeed = Math.max(500, Math.min(5000, state.scanSpeed + delta));
    setScanSpeed(newSpeed);
    updateSettings({ scanSpeed: newSpeed });
    if (scanActive) {
      stopScan();
      setScanItems(scanItemList.current);
      startScan();
    }
  }, [scanActive, updateSettings]);

  const isScanFocused = useCallback((type, id) => {
    if (!scanActive || scanFocusIndex < 0) return false;
    const focused = scanItemList.current[scanFocusIndex];
    return focused && focused.type === type && focused.id === id;
  }, [scanActive, scanFocusIndex]);

  const scanRingStyle = { borderColor: '#FF6600', borderWidth: 4 };

  // Fetch AI suggestions when sentence changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sentenceWords.length === 0) {
        if (aiEnabled) {
          const top = getTopWords(6);
          if (!cancelled) setSuggestions(top.length > 0 ? top.map(w => ({ word: w, reason: 'used often' })) : []);
        } else {
          setSuggestions([]);
        }
        return;
      }

      // Layer 1: Bigram predictions (instant, local, personalised by usage history)
      const lastWord = sentenceWords[sentenceWords.length - 1];
      const bigramResults = aiEnabled ? getBigramPredictions(lastWord, 4) : [];
      if (bigramResults.length > 0 && !cancelled) {
        if (aiEnabled) recordSourceShown('bigram', bigramResults.length);
        const scored = scoreWithExplanation(bigramResults);
        setSuggestions(scored.map(s => ({ word: s.word, reason: s.reason })));
      }

      // Layer 2: On-device personalized model (adapts to this user's patterns during session)
      let personalResults = [];
      try {
        personalResults = await personalPredict(sentenceWords, 4);
        if (!cancelled && personalResults.length > 0) {
          // Merge personal predictions with bigram results, label as 'learned'
          const combined = [...new Set([...bigramResults, ...personalResults])];
          const scored = scoreWithExplanation(combined);
          // Override reason for words that came only from the personalized model
          const bigramSet = new Set(bigramResults);
          const labeled = scored.map(s => ({
            word: s.word,
            reason: !bigramSet.has(s.word) && personalResults.includes(s.word) ? 'learned' : s.reason,
          }));
          setSuggestions(labeled.slice(0, 6));
        }
      } catch {
        // Personalized model is optional — bigram results still showing
      }

      // Layer 3: Static neural model (async, pre-trained, not personalized)
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
      } catch {
        // Bigram + personal results are already showing
      }

      // Also try Vertex AI for richer phrase suggestions (async, non-blocking)
      if (aiEnabled && sentenceWords.length >= 2) {
        try {
          const recentTexts = getSentenceHistory().slice(0, 3).map(h => h.text);
          const vertexPhrases = await getAACPhraseSuggestions(sentenceWords, recentTexts);
          if (!cancelled && vertexPhrases.length > 0) {
            if (aiEnabled) recordSourceShown('vertex', vertexPhrases.length);
            setSuggestions(prev => {
              const existingWords = prev.map(s => typeof s === 'string' ? s : s.word);
              const newPhrases = vertexPhrases
                .filter(p => !existingWords.includes(p))
                .map(p => ({ word: p, reason: 'AI suggested' }));
              return [...prev, ...newPhrases].slice(0, 8);
            });
          }
        } catch {
          // Vertex AI is optional
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
        // Feed the on-device model: prev words → selected word
        // This runs async, never blocks speech, and silently fails if model isn't loaded
        recordTap(prev, label).catch(() => {});
      }
      return next;
    });
    speak(label, applyPreset(voicePreset, {
      rate: settings.speechRate,
      pitch: settings.speechPitch,
      voice: settings.speechVoice,
    }));
  }, [settings, aiEnabled, voicePreset, recordTap]);

  const handleButtonPress = useCallback((button) => {
    if (button.navigateTo) {
      navigateToPage(button.navigateTo);
    } else if (button.multiWord) {
      // Sentence starters: add all words at once, speak the phrase
      const words = button.label.split(' ');
      setSentenceWords(prev => [...prev, ...words]);
      speak(button.label, applyPreset(voicePreset, {
        rate: settings.speechRate, pitch: settings.speechPitch, voice: settings.speechVoice,
      }));
    } else {
      addWord(button.label);
    }
  }, [navigateToPage, addWord, settings, voicePreset]);

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
    const focused = isScanFocused('vocab', item.id);

    return (
      <TouchableOpacity
        style={[
          styles.vocabButton,
          {
            backgroundColor: buttonColor,
            borderColor: settings.theme === 'highContrast' ? palette.border : '#DDD',
            flex: 1 / numColumns,
          },
          focused && scanRingStyle,
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
        accessibilityState={{ selected: focused }}
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
  }, [handleButtonPress, numColumns, palette, settings.theme, isScanFocused]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Sentence bar — words on top, actions below */}
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
              {t('tapToSpeak')}
            </Text>
          ) : (
            sentenceWords.map((word, i) => (
              <Text key={`${i}-${word}`} style={[styles.sentenceWord, { color: palette.text }]}>
                {word}
              </Text>
            ))
          )}
        </View>

        {/* Action buttons — wrapped row below sentence words */}
        <View style={styles.sentenceActions}>
          <TouchableOpacity
            onPress={speakSentence}
            style={[styles.speakBtn, { backgroundColor: palette.primary }, isScanFocused('action', 'speak') && scanRingStyle]}
            accessibilityRole="button"
            accessibilityLabel={
              sentenceWords.length > 0
                ? `Speak sentence: ${sentenceWords.join(' ')}`
                : 'Speak button. Build a sentence first.'
            }
            disabled={sentenceWords.length === 0}
            accessibilityState={{ selected: isScanFocused('action', 'speak') }}
          >
            <Ionicons name="volume-high" size={24} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeLastWord}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }, isScanFocused('action', 'backspace') && scanRingStyle]}
            accessibilityRole="button"
            accessibilityLabel={t('deleteLastWord')}
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="backspace-outline" size={20} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearSentence}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.danger }, isScanFocused('action', 'clear') && scanRingStyle]}
            accessibilityRole="button"
            accessibilityLabel={t('clearSentence')}
            disabled={sentenceWords.length === 0}
          >
            <Ionicons name="trash-outline" size={20} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowFavourites(f => !f); setShowHistory(false); setShowSmart(false); }}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.warning }]}
            accessibilityRole="button"
            accessibilityLabel={showFavourites ? t('hideFavourites') : t('showFavourites')}
          >
            <Ionicons name="star" size={18} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowHistory(h => !h); setShowFavourites(false); setShowSmart(false); }}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.info }]}
            accessibilityRole="button"
            accessibilityLabel={showHistory ? t('hideHistory') : t('showHistory')}
          >
            <Ionicons name="time-outline" size={18} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowSmart(s => !s); setShowFavourites(false); setShowHistory(false); }}
            style={[styles.sentenceActionBtn, { backgroundColor: showSmart ? palette.warning : palette.chipBg }]}
            accessibilityRole="button"
            accessibilityLabel={showSmart ? 'Hide smart suggestions' : 'Show smart suggestions'}
          >
            <Ionicons name="bulb-outline" size={18} color={showSmart ? palette.buttonText : palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Camera')}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('openCamera')}
          >
            <Ionicons name="camera-outline" size={18} color={palette.buttonText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Social')}
            style={[styles.sentenceActionBtn, { backgroundColor: palette.success }]}
            accessibilityRole="button"
            accessibilityLabel="Social phrases"
          >
            <Ionicons name="chatbubbles-outline" size={18} color={palette.buttonText} />
          </TouchableOpacity>
          {sentenceWords.length > 0 && (
            <TouchableOpacity
              onPress={handleToggleFavourite}
              style={[styles.sentenceActionBtn, { backgroundColor: isCurrentFavourite ? palette.warning : palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={isCurrentFavourite ? t('removeFromFavourites') : t('addToFavourites')}
            >
              <Ionicons name={isCurrentFavourite ? 'star' : 'star-outline'} size={16} color={isCurrentFavourite ? palette.buttonText : palette.text} />
            </TouchableOpacity>
          )}
          {sentenceWords.length > 0 && (
            <TouchableOpacity
              onPress={() => setDisplayMode('display')}
              style={[styles.sentenceActionBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={t('showOnScreen')}
            >
              <Ionicons name="tv-outline" size={16} color={palette.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Voice preset picker */}
      <VoicePresetPicker activePreset={voicePreset} onSelect={setVoicePreset} />

      {/* Scan control bar */}
      <View style={[styles.scanBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={toggleScan}
          style={[styles.scanToggle, { backgroundColor: scanActive ? '#FF6600' : palette.chipBg }]}
          accessibilityRole="button"
          accessibilityLabel={scanActive ? t('stopScanning') : t('startScanning')}
          accessibilityState={{ selected: scanActive }}
        >
          <Ionicons name={scanActive ? 'stop' : 'scan-outline'} size={16} color={scanActive ? '#FFF' : palette.text} />
          <Text style={[styles.scanToggleText, { color: scanActive ? '#FFF' : palette.text }]}>
            {scanActive ? t('scanning') : t('scan')}
          </Text>
        </TouchableOpacity>
        {scanActive && (
          <>
            <TouchableOpacity
              onPress={() => changeScanMode(getScanState().scanMode === 'auto' ? 'step' : 'auto')}
              style={[styles.scanOptionBtn, { backgroundColor: palette.chipBg }]}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${getScanState().scanMode === 'auto' ? 'step' : 'auto'} scan`}
            >
              <Text style={[styles.scanOptionText, { color: palette.text }]}>
                {getScanState().scanMode === 'auto' ? 'Auto' : 'Step'}
              </Text>
            </TouchableOpacity>
            {getScanState().scanMode === 'auto' && (
              <>
                <TouchableOpacity
                  onPress={() => changeScanSpeed(500)}
                  style={[styles.scanOptionBtn, { backgroundColor: palette.chipBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('scanSlower')}
                >
                  <Text style={[styles.scanOptionText, { color: palette.text }]}>{t('scanSlower')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => changeScanSpeed(-500)}
                  style={[styles.scanOptionBtn, { backgroundColor: palette.chipBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('scanFaster')}
                >
                  <Text style={[styles.scanOptionText, { color: palette.text }]}>{t('scanFaster')}</Text>
                </TouchableOpacity>
              </>
            )}
            {getScanState().scanMode === 'step' && (
              <>
                <TouchableOpacity
                  onPress={advanceScan}
                  style={[styles.scanOptionBtn, { backgroundColor: palette.info }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('scanNext')}
                >
                  <Text style={[styles.scanOptionText, { color: palette.buttonText }]}>{t('scanNext')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={selectCurrent}
                  style={[styles.scanOptionBtn, { backgroundColor: palette.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('scanSelect')}
                >
                  <Text style={[styles.scanOptionText, { color: palette.buttonText }]}>{t('scanSelect')}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>

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
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>{t('favourites')}</Text>
          {favourites.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {t('noFavourites')}
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
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>{t('sentenceHistory')}</Text>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {t('noHistory')}
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

      {/* Smart suggestions panel — learning-based shortcuts */}
      <SmartSuggestionsPanel
        visible={showSmart}
        palette={palette}
        settings={settings}
        onSpeakPhrase={(text) => {
          const words = text.split(' ');
          setSentenceWords(words);
        }}
        onAddWord={(word, category) => {
          addCustomVocabItem(word, category || 'noun', 'smart-suggestion').catch(() => {});
        }}
        onCreateQuickPage={() => {
          setShowSmart(false);
          navigation.navigate('Contexts');
        }}
        onRefresh={() => setFavourites([...getFavourites()])}
      />

      {/* AI Suggestions strip */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsBar, { backgroundColor: palette.surface }]}>
          <Ionicons name="sparkles-outline" size={16} color={palette.textSecondary} style={{ marginRight: 4 }} />
          <FlatList
            data={suggestions}
            horizontal
            keyExtractor={(item, i) => `${typeof item === 'string' ? item : item.word}-${i}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const word = typeof item === 'string' ? item : item.word;
              const reason = typeof item === 'string' ? null : item.reason;
              const sugFocused = isScanFocused('suggestion', `sug-${index}`);
              return (
                <TouchableOpacity
                  style={[styles.suggestionChip, { backgroundColor: palette.chipBg, borderColor: palette.border }, sugFocused && scanRingStyle]}
                  onPress={() => handleSuggestionPress(word)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggestion: ${word}${reason ? `. ${reason}` : ''}`}
                  accessibilityHint="Add this word to your sentence"
                >
                  <Text style={[styles.suggestionText, { color: palette.text }]}>{word}</Text>
                  {reason && (
                    <Text style={[styles.suggestionReason, { color: palette.textSecondary }]}>{reason}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
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
            accessibilityLabel={t('goHome')}
          >
            <Ionicons name="home-outline" size={18} color={palette.text} />
            <Text style={[styles.breadcrumbText, { color: palette.text }]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goBack}
            style={[styles.breadcrumbBtn, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('goBack')}
          >
            <Ionicons name="arrow-back" size={18} color={palette.text} />
            <Text style={[styles.breadcrumbText, { color: palette.text }]}>{t('goBack')}</Text>
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
        extraData={scanFocusIndex}
        removeClippedSubviews={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sentenceBar: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 2,
  },
  sentenceWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 32,
    marginBottom: 4,
  },
  sentenceWord: { fontSize: 20, fontWeight: '500', marginRight: 6, paddingVertical: 2 },
  placeholder: { fontSize: 16, fontStyle: 'italic' },
  sentenceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  sentenceActionBtn: {
    padding: 6,
    borderRadius: 8,
    minWidth: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 34,
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
  suggestionReason: { fontSize: 10, marginTop: 1 },
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
  scanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scanToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  scanToggleText: { fontSize: 13, fontWeight: '600' },
  scanOptionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  scanOptionText: { fontSize: 12, fontWeight: '600' },
});
