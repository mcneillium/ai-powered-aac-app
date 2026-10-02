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

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { speak, stop, buildSpeechOptions, subscribeSpeechStatus } from '../services/speechService';
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
  recordSourceShown,
  recordFailedSearch,
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
import WordFinder from '../components/WordFinder';
import MoreActionsMenu from '../components/MoreActionsMenu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openQuickPhrases, setQuickPhrasesButtonHidden } from '../components/QuickRepairOverlay';
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
  const [history, setHistory] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [voicePreset, setVoicePreset] = useState('normal');
  const [displayMode, setDisplayMode] = useState(null); // null | 'display' | 'listener'
  const [lastSpoken, setLastSpoken] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanFocusIndex, setScanFocusIndex] = useState(-1);
  // Previous sentence, kept so Clear / Delete / replacing the sentence from
  // history can be undone. Cleared once the user adds a new word.
  const [undoWords, setUndoWords] = useState(null);
  const [showFinder, setShowFinder] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const insets = useSafeAreaInsets();
  const [speechProblem, setSpeechProblem] = useState(null); // null | 'unavailable' | 'failed'
  const sentenceBarRef = useRef(null);
  const sentenceScrollRef = useRef(null);

  // The board has its own Quick Phrases button in the action row; hide the
  // floating one here so it never sits on top of a vocabulary button.
  useFocusEffect(useCallback(() => {
    setQuickPhrasesButtonHidden(true);
    return () => setQuickPhrasesButtonHidden(false);
  }, []));

  // Memoized: getPage builds a fresh object per call, and a new identity on
  // every render would reset the switch-scanning item list (and scan position).
  // isFocused is a dependency so custom-vocab edits made on other screens are
  // picked up when the user returns to the board.
  const isFocused = useIsFocused();
  const currentPage = useMemo(
    () => getPage(currentPageId) || getHomePage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPageId, isFocused]
  );
  const aiEnabled = settings.aiPersonalisationEnabled !== false;
  const cloudEnabled = settings.cloudSuggestionsEnabled !== false;
  const predictionEnabled = settings.predictionEnabled !== false;
  const speakWordsOnTap = settings.speakWordsOnTap !== false;
  const textScale = settings.textScale || 1;
  // Opt-in layout for small screens. Never switched on automatically, so
  // existing users' button positions only change if they choose it.
  const compact = settings.compactLayout === true;

  // One set of speech options for every utterance on this screen, so the
  // user's voice, speed and pitch (plus the chosen voice style) always apply.
  const speechOptions = useMemo(
    () => buildSpeechOptions(settings, voicePreset),
    [settings, voicePreset]
  );
  const say = useCallback((text) => speak(text, speechOptions), [speechOptions]);

  // Tell the user (once, non-blocking) when speech could not be produced.
  // The message itself stays on screen, so communication can continue by
  // showing it (Show on screen button).
  useEffect(() => {
    let timer = null;
    const unsubscribe = subscribeSpeechStatus(({ error }) => {
      if (!error) {
        // Speech started (or a late start recovered): drop any old notice.
        clearTimeout(timer);
        setSpeechProblem(null);
        return;
      }
      setSpeechProblem(error);
      clearTimeout(timer);
      timer = setTimeout(() => setSpeechProblem(null), 8000);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  // Load persistent data on mount
  useEffect(() => {
    loadSentenceHistory().then(setHistory);
    loadFavourites().then(setFavourites);
  }, []);

  // ── Switch scanning ──
  // Scan order: vocab grid first (main communication), then suggestions, then actions last.
  // This puts the most-used items at the start of the scan cycle.
  const scanItemList = useRef([]);

  // Use refs for action callbacks to avoid stale closures in scan select handler.
  // The callbacks are declared with `const` further down, so the refs start
  // empty and are populated by the effects below (which run after render).
  const speakRef = useRef(null);
  const backspaceRef = useRef(null);
  const clearRef = useRef(null);
  const undoRef = useRef(null);
  const buttonPressRef = useRef(null);
  const suggestionPressRef = useRef(null);

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
      { type: 'action', id: 'undo', label: 'Undo' },
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
        if (item.id === 'speak') speakRef.current?.();
        else if (item.id === 'backspace') backspaceRef.current?.();
        else if (item.id === 'clear') clearRef.current?.();
        else if (item.id === 'undo') undoRef.current?.();
      } else if (item.type === 'vocab') {
        buttonPressRef.current?.(item.button);
      } else if (item.type === 'suggestion') {
        suggestionPressRef.current?.(item.word);
      }
    });
    return () => { cleanupScan(); };
  }, []);

  // Initialize scan service from persisted settings
  useEffect(() => {
    if (settings.scanMode) setScanMode(settings.scanMode);
    if (settings.scanSpeed) setScanSpeed(settings.scanSpeed);
  }, [settings.scanMode, settings.scanSpeed]);

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

  const scanRingStyle = useMemo(
    () => ({ borderColor: palette.focusRing, borderWidth: 4 }),
    [palette.focusRing]
  );

  // Fetch AI suggestions when sentence changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!predictionEnabled) {
        setSuggestions([]);
        return;
      }
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

      // Also try Vertex AI for richer phrase suggestions (async, non-blocking).
      // Gated on the "Online suggestions" privacy setting — this is the only
      // suggestion path that sends sentence content off-device.
      if (aiEnabled && cloudEnabled && sentenceWords.length >= 2) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceWords, aiEnabled, cloudEnabled, predictionEnabled]);

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

  // Replace the whole sentence while remembering the old one for Undo.
  const replaceSentence = useCallback((words) => {
    setSentenceWords(prev => {
      setUndoWords(prev.length > 0 ? prev : null);
      return words;
    });
  }, []);

  const addWords = useCallback((words) => {
    setUndoWords(null);
    setSentenceWords(prev => [...prev, ...words]);
  }, []);

  const addWord = useCallback((label, wasSuggestion = false) => {
    setUndoWords(null);
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
    if (speakWordsOnTap) say(label);
  }, [aiEnabled, recordTap, say, speakWordsOnTap]);

  const handleButtonPress = useCallback((button) => {
    if (button.navigateTo) {
      navigateToPage(button.navigateTo);
    } else if (button.multiWord) {
      // Sentence starters: add all words at once, speak the phrase
      addWords(button.label.split(' '));
      if (speakWordsOnTap) say(button.label);
    } else {
      addWord(button.label);
    }
  }, [navigateToPage, addWord, addWords, say, speakWordsOnTap]);

  // Suggestions are only ever added on an explicit tap — never automatically.
  const handleSuggestionPress = useCallback((word) => {
    // If suggestion is a multi-word phrase, add all words
    const words = word.split(' ');
    if (words.length > 1) {
      addWords(words);
      if (speakWordsOnTap) say(word);
    } else {
      addWord(word, true);
    }
  }, [addWord, addWords, say, speakWordsOnTap]);

  const speakSentence = useCallback(async () => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      say(text);
      setLastSpoken(text);
      if (aiEnabled) recordSentenceSpoken(sentenceWords).catch(() => {});

      await addSentenceToHistory(text);
      setHistory([...getSentenceHistory()]);
    }
  }, [sentenceWords, aiEnabled, say]);

  const removeLastWord = useCallback(() => {
    setSentenceWords(prev => {
      if (prev.length > 0) setUndoWords(prev);
      return prev.slice(0, -1);
    });
  }, []);

  const clearSentence = useCallback(() => {
    replaceSentence([]);
    stop();
  }, [replaceSentence]);

  const undo = useCallback(() => {
    if (!undoWords) return;
    setSentenceWords(undoWords);
    setUndoWords(null);
  }, [undoWords]);

  // Keep the scan-select refs pointing at the latest callbacks.
  useEffect(() => { speakRef.current = speakSentence; }, [speakSentence]);
  useEffect(() => { backspaceRef.current = removeLastWord; }, [removeLastWord]);
  useEffect(() => { clearRef.current = clearSentence; }, [clearSentence]);
  useEffect(() => { undoRef.current = undo; }, [undo]);
  useEffect(() => { buttonPressRef.current = handleButtonPress; }, [handleButtonPress]);
  useEffect(() => { suggestionPressRef.current = handleSuggestionPress; }, [handleSuggestionPress]);

  const repeatFromHistory = useCallback((text) => {
    replaceSentence(text.split(' '));
    say(text);
    setLastSpoken(text);
    incrementSpeakCount(text)
      .then(() => setHistory([...getSentenceHistory()]))
      .catch(() => {});
    setShowHistory(false);
  }, [replaceSentence, say]);

  const handleToggleFavourite = useCallback(async () => {
    const text = sentenceWords.join(' ').trim();
    if (!text) return;

    if (isFavourite(text)) {
      const fav = getFavourites().find(f => f.phrase === text);
      if (fav) await removeFavourite(fav.id);
    } else {
      const added = await addFavourite(text);
      if (!added) Alert.alert(t('favourites'), t('favouritesFull'));
    }
    setFavourites([...getFavourites()]);
  }, [sentenceWords]);

  const confirmRemoveFavourite = useCallback((fav) => {
    Alert.alert(t('removeFavourite'), `"${fav.phrase}"`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('removeFavourite'),
        style: 'destructive',
        onPress: async () => {
          await removeFavourite(fav.id);
          setFavourites([...getFavourites()]);
        },
      },
    ]);
  }, []);

  const speakFavourite = useCallback((phrase) => {
    replaceSentence(phrase.split(' '));
    say(phrase);
    setLastSpoken(phrase);
    addSentenceToHistory(phrase)
      .then(() => setHistory([...getSentenceHistory()]))
      .catch(() => {});
    setShowFavourites(false);
  }, [replaceSentence, say]);

  // Find-a-word: add the word exactly as a board tap would.
  const handleFinderAdd = useCallback((button) => {
    setShowFinder(false);
    handleButtonPress(button);
  }, [handleButtonPress]);

  const handleFinderShowPage = useCallback((pageId) => {
    setShowFinder(false);
    if (pageId === 'home') goHome();
    else if (pageId !== currentPageId) navigateToPage(pageId);
  }, [goHome, navigateToPage, currentPageId]);

  const handleFinderNoResults = useCallback((term) => {
    // Helps caregivers spot missing vocabulary (stays on-device).
    if (aiEnabled) recordFailedSearch(term).catch(() => {});
  }, [aiEnabled]);

  const numColumns = settings.gridSize || 4;
  const currentSentenceText = sentenceWords.join(' ').trim();
  const isCurrentFavourite = currentSentenceText ? isFavourite(currentSentenceText) : false;

  const renderButton = useCallback(({ item }) => {
    const isNavButton = !!item.navigateTo;
    const buttonColor = settings.theme === 'highContrast' ? palette.cardBg : item.color;
    const buttonTextColor = settings.theme === 'highContrast' ? palette.text : item.textColor;
    const focused = isScanFocused('vocab', item.id);
    const labelSize = (numColumns >= 4 ? 13 : 15) * textScale;

    return (
      <TouchableOpacity
        style={[
          styles.vocabButton,
          {
            backgroundColor: buttonColor,
            borderColor: settings.theme === 'highContrast' ? palette.border : '#DDD',
            flex: 1 / numColumns,
            minHeight: Math.round(72 * textScale),
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
          <Ionicons name={item.icon} size={Math.round(20 * textScale)} color={buttonTextColor} style={styles.buttonIcon} />
        )}
        <Text
          style={[styles.buttonLabel, { color: buttonTextColor, fontSize: labelSize }]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [handleButtonPress, numColumns, palette, settings.theme, isScanFocused, textScale, scanRingStyle]);

  const hasWords = sentenceWords.length > 0;
  const sentenceLineHeight = Math.round(26 * textScale);
  const showScanBar = settings.showScanControls !== false || scanActive;
  const isHome = currentPageId === 'home';

  // Small helper so every sentence action has the same size, disabled look
  // and accessibility state.
  const actionButton = ({ onPress, icon, iconSize = 20, bg, fg = palette.buttonText, label, disabled, scanId, style, children }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        style || styles.sentenceActionBtn,
        { backgroundColor: bg },
        disabled && styles.disabled,
        scanId && isScanFocused('action', scanId) && scanRingStyle,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, selected: scanId ? isScanFocused('action', scanId) : false }}
    >
      <Ionicons name={icon} size={iconSize} color={fg} />
      {children}
    </TouchableOpacity>
  );

  const speakButton = actionButton({
    onPress: speakSentence,
    icon: 'volume-high',
    iconSize: 24,
    bg: palette.primary,
    label: hasWords ? `Speak sentence: ${sentenceWords.join(' ')}` : 'Speak button. Build a sentence first.',
    disabled: !hasWords,
    scanId: 'speak',
    style: styles.speakBtn,
  });
  const deleteButton = actionButton({
    onPress: removeLastWord, icon: 'backspace-outline', bg: palette.danger,
    label: t('deleteLastWord'), disabled: !hasWords, scanId: 'backspace',
  });
  const clearButton = actionButton({
    onPress: clearSentence, icon: 'trash-outline', bg: palette.danger,
    label: t('clearSentence'), disabled: !hasWords, scanId: 'clear',
  });
  const toggleFavourites = () => { setShowFavourites(f => !f); setShowHistory(false); };
  const toggleHistory = () => { setShowHistory(h => !h); setShowFavourites(false); };
  const favListButton = actionButton({
    onPress: toggleFavourites, icon: 'star', iconSize: 18, bg: palette.warning,
    label: showFavourites ? t('hideFavourites') : t('showFavourites'),
  });
  const historyButton = actionButton({
    onPress: toggleHistory, icon: 'time-outline', iconSize: 18, bg: palette.info,
    label: showHistory ? t('hideHistory') : t('showHistory'),
  });
  const cameraButton = actionButton({
    onPress: () => navigation.navigate('Camera'),
    icon: 'camera-outline', iconSize: 18, bg: palette.accent,
    label: t('openCamera'),
  });
  const undoButton = actionButton({
    onPress: undo, icon: 'arrow-undo-outline', iconSize: 18, bg: palette.chipBg, fg: palette.text,
    label: undoWords ? t('undoLabel') : t('nothingToUndo'), disabled: !undoWords, scanId: 'undo',
  });
  const favToggleButton = actionButton({
    onPress: handleToggleFavourite,
    icon: isCurrentFavourite ? 'star' : 'star-outline',
    iconSize: 18,
    bg: isCurrentFavourite ? palette.warning : palette.chipBg,
    fg: isCurrentFavourite ? palette.buttonText : palette.text,
    label: isCurrentFavourite ? t('removeFromFavourites') : t('addToFavourites'),
    disabled: !hasWords,
  });
  const displayButton = actionButton({
    onPress: () => setDisplayMode('display'),
    icon: 'tv-outline', iconSize: 18, bg: palette.chipBg, fg: palette.text,
    label: t('showOnScreen'),
    disabled: !hasWords,
  });
  const quickButton = actionButton({
    onPress: openQuickPhrases,
    icon: 'flash', iconSize: 18, bg: palette.primary,
    label: t('quickPhrasesLabel'),
  });
  const moreButton = actionButton({
    onPress: () => setShowMore(true),
    icon: 'ellipsis-horizontal', iconSize: 20, bg: palette.chipBg, fg: palette.text,
    label: t('moreActionsLabel'),
  });
  const moreItems = [
    { key: 'favs', icon: 'star', label: showFavourites ? t('hideFavourites') : t('showFavourites'), onPress: toggleFavourites },
    { key: 'history', icon: 'time-outline', label: showHistory ? t('hideHistory') : t('showHistory'), onPress: toggleHistory },
    {
      key: 'favToggle', icon: isCurrentFavourite ? 'star' : 'star-outline',
      label: isCurrentFavourite ? t('removeFromFavourites') : t('addToFavourites'),
      onPress: handleToggleFavourite, disabled: !hasWords,
    },
    { key: 'display', icon: 'tv-outline', label: t('showOnScreen'), onPress: () => setDisplayMode('display'), disabled: !hasWords },
    { key: 'camera', icon: 'camera-outline', label: t('openCamera'), onPress: () => navigation.navigate('Camera') },
  ];

  // Small square icon button used by the compact page row.
  const iconButton = ({ onPress, icon, label, disabled, active }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconBtn, { backgroundColor: active ? palette.focusRing : palette.surface }, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
    >
      <Ionicons name={icon} size={20} color={active ? '#000' : palette.text} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.background }, compact && { paddingTop: insets.top }]}>
      {/* Sentence bar — words on top, actions below */}
      <View
        ref={sentenceBarRef}
        style={[styles.sentenceBar, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        {/* Only the words are grouped as one accessible element. Grouping the
            whole bar hid the action buttons from VoiceOver / Switch Control. */}
        <ScrollView
          ref={sentenceScrollRef}
          // Standard: two lines. Compact: exactly one line (no half-cut line);
          // earlier words scroll and the whole message can be shown on screen.
          style={{ height: compact ? sentenceLineHeight + 8 : Math.round(64 * textScale) }}
          contentContainerStyle={styles.sentenceWords}
          onContentSizeChange={() => sentenceScrollRef.current?.scrollToEnd({ animated: false })}
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            hasWords
              ? `Sentence: ${sentenceWords.join(' ')}`
              : 'Sentence bar is empty. Tap words below to build a sentence.'
          }
          accessibilityLiveRegion="polite"
        >
          {!hasWords ? (
            <Text style={[styles.placeholder, { color: palette.textSecondary }]}>
              {t('tapToSpeak')}
            </Text>
          ) : (
            sentenceWords.map((word, i) => (
              <Text
                key={`${i}-${word}`}
                style={[styles.sentenceWord, { color: palette.text, fontSize: Math.round(20 * textScale), lineHeight: sentenceLineHeight }]}
              >
                {word}
              </Text>
            ))
          )}
        </ScrollView>

        {/* Action buttons — fixed order so their positions never move.
            Compact layout: one row of core actions + More. */}
        {compact ? (
          <View style={[styles.sentenceActions, styles.sentenceActionsCompact]}>
            {speakButton}{deleteButton}{clearButton}{undoButton}{quickButton}{moreButton}
          </View>
        ) : (
          <View style={styles.sentenceActions}>
            {speakButton}{deleteButton}{clearButton}{favListButton}{historyButton}
            {cameraButton}{undoButton}{favToggleButton}{displayButton}{quickButton}
          </View>
        )}
      </View>

      {/* Voice preset picker (optional) */}
      {!compact && settings.showVoiceStyles !== false && (
        <VoicePresetPicker activePreset={voicePreset} onSelect={setVoicePreset} />
      )}

      {/* Scan control bar (optional; always shown while scanning so it can be stopped) */}
      {!compact && showScanBar && (
      <View style={[styles.scanBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={toggleScan}
          style={[styles.scanToggle, { backgroundColor: scanActive ? palette.focusRing : palette.chipBg }]}
          accessibilityRole="button"
          accessibilityLabel={scanActive ? t('stopScanning') : t('startScanning')}
          accessibilityState={{ selected: scanActive }}
        >
          <Ionicons name={scanActive ? 'stop' : 'scan-outline'} size={16} color={scanActive ? '#000' : palette.text} />
          <Text style={[styles.scanToggleText, { color: scanActive ? '#000' : palette.text }]}>
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
      )}

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

      <WordFinder
        visible={showFinder}
        onClose={() => setShowFinder(false)}
        onAddWord={handleFinderAdd}
        onShowPage={handleFinderShowPage}
        onNoResults={handleFinderNoResults}
      />

      {/* Favourites panel — scrolls so every saved favourite is reachable */}
      {showFavourites && (
        <View style={[styles.historyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>
            {t('favourites')}{favourites.length > 0 ? ` (${favourites.length})` : ''}
          </Text>
          {favourites.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {t('noFavourites')}
            </Text>
          ) : (
            <ScrollView style={styles.panelScroll} nestedScrollEnabled>
              {favourites.map((fav) => (
                <View key={fav.id} style={[styles.historyItem, { borderBottomColor: palette.border }]}>
                  <TouchableOpacity
                    style={styles.historyMain}
                    onPress={() => speakFavourite(fav.phrase)}
                    accessibilityRole="button"
                    accessibilityLabel={`Speak favourite: ${fav.phrase}`}
                  >
                    <Ionicons name="star" size={16} color={palette.warning} />
                    <Text style={[styles.historyText, { color: palette.text }]} numberOfLines={2}>
                      {fav.phrase}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowIconBtn}
                    onPress={() => confirmRemoveFavourite(fav)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('removeFavourite')}: ${fav.phrase}`}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Sentence history dropdown — scrolls through all saved sentences */}
      {showHistory && (
        <View style={[styles.historyPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.historyTitle, { color: palette.textSecondary }]}>{t('sentenceHistory')}</Text>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              {t('noHistory')}
            </Text>
          ) : (
            <ScrollView style={styles.panelScroll} nestedScrollEnabled>
              {history.map((item, i) => (
                <TouchableOpacity
                  key={`${i}-${item.timestamp}`}
                  style={[styles.historyItem, styles.historyMain, { borderBottomColor: palette.border }]}
                  onPress={() => repeatFromHistory(item.text)}
                  accessibilityRole="button"
                  accessibilityLabel={`Repeat: ${item.text}`}
                >
                  <Ionicons name="refresh-outline" size={16} color={palette.primary} />
                  <Text style={[styles.historyText, { color: palette.text }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                  {(item.speakCount || 0) > 1 && (
                    <Text style={[styles.speakCount, { color: palette.textSecondary }]}>
                      {item.speakCount}x
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Suggestions strip — fixed height so the grid below never jumps when
          suggestions appear or disappear (protects learned motor plans). */}
      {predictionEnabled && (
        <View
          // A fixed height (not minHeight): chips with a reason line are
          // taller than an empty row, and the grid must not move when they
          // appear. Compact layout uses the same height for that reason.
          style={[styles.suggestionsBar, { backgroundColor: palette.surface, height: Math.round(56 * Math.min(textScale, 1.25)) }]}
        >
          <Ionicons name="sparkles-outline" size={16} color={palette.textSecondary} style={{ marginRight: 4 }} />
          {suggestions.length === 0 ? (
            <Text style={[styles.suggestionsEmpty, { color: palette.textSecondary }]}>
              {t('suggestionsEmpty')}
            </Text>
          ) : (
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
                  <Text style={[styles.suggestionText, { color: palette.text, fontSize: Math.round(15 * textScale) }]}>{word}</Text>
                  {reason && (
                    <Text style={[styles.suggestionReason, { color: palette.textSecondary }]}>{reason}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
          )}
        </View>
      )}

      {/* Compact page row: icon-only buttons, plus Scan and Settings (the
          board header is hidden in compact layout). Always present. */}
      {compact ? (
        <View style={[styles.breadcrumb, styles.breadcrumbCompact]}>
          {iconButton({ onPress: goHome, icon: 'home-outline', label: t('goHome'), disabled: isHome })}
          {iconButton({ onPress: goBack, icon: 'arrow-back', label: t('goBack'), disabled: pageHistory.length === 0 })}
          <Text style={[styles.pageTitle, { color: palette.text, flex: 1 }]} numberOfLines={1} accessibilityRole="header">
            {currentPage.label}
          </Text>
          {iconButton({ onPress: () => setShowFinder(true), icon: 'search', label: t('findWordLabel') })}
          {settings.showScanControls !== false && iconButton({
            onPress: toggleScan, icon: scanActive ? 'stop' : 'scan-outline',
            label: scanActive ? t('stopScanning') : t('startScanning'), active: scanActive,
          })}
          {iconButton({ onPress: () => navigation.navigate('Settings'), icon: 'settings-outline', label: 'Open settings' })}
        </View>
      ) : (
      // Standard navigation row — always present (also on Home) so the grid
      // starts at the same place on every page.
      <View style={styles.breadcrumb}>
        <TouchableOpacity
          onPress={goHome}
          disabled={isHome}
          style={[styles.breadcrumbBtn, { backgroundColor: palette.surface }, isHome && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('goHome')}
          accessibilityState={{ disabled: isHome }}
        >
          <Ionicons name="home-outline" size={18} color={palette.text} />
          <Text style={[styles.breadcrumbText, { color: palette.text }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goBack}
          disabled={pageHistory.length === 0}
          style={[styles.breadcrumbBtn, { backgroundColor: palette.surface }, pageHistory.length === 0 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('goBack')}
          accessibilityState={{ disabled: pageHistory.length === 0 }}
        >
          <Ionicons name="arrow-back" size={18} color={palette.text} />
          <Text style={[styles.breadcrumbText, { color: palette.text }]}>{t('goBack')}</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: palette.text }]} numberOfLines={1} accessibilityRole="header">
          {currentPage.label}
        </Text>
        <TouchableOpacity
          onPress={() => setShowFinder(true)}
          style={[styles.breadcrumbBtn, styles.findBtn, { backgroundColor: palette.surface }]}
          accessibilityRole="button"
          accessibilityLabel={t('findWordLabel')}
        >
          <Ionicons name="search" size={18} color={palette.text} />
          <Text style={[styles.breadcrumbText, { color: palette.text }]}>{t('findWord')}</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Speech problem notice — overlays (does not move the grid) and lets
          taps pass through to the buttons underneath. */}
      {speechProblem && (
        <View
          pointerEvents="none"
          style={[
            styles.speechNotice,
            // Sit above the tab bar and above the compact scanning strip so
            // neither is covered.
            { backgroundColor: palette.text, bottom: 60 + insets.bottom + (compact && scanActive ? 76 : 12) },
          ]}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          <Ionicons name="volume-mute-outline" size={20} color={palette.background} />
          <Text style={[styles.speechNoticeText, { color: palette.background }]}>
            {speechProblem === 'unavailable' ? t('speechUnavailable') : t('speechFailed')}
          </Text>
        </View>
      )}

      {/* Compact layout scanning strip: overlays the bottom of the grid
          instead of inserting a row, so words do not move when scanning
          starts. Scan mode and speed are set in Settings. */}
      {compact && scanActive && (
        <View style={[styles.scanStrip, { backgroundColor: palette.surface, borderColor: palette.focusRing, bottom: 60 + insets.bottom }]}>
          <TouchableOpacity
            onPress={toggleScan}
            style={[styles.scanOptionBtn, { backgroundColor: palette.focusRing }]}
            accessibilityRole="button"
            accessibilityLabel={t('stopScanning')}
          >
            <Text style={[styles.scanOptionText, { color: '#000' }]}>{t('stopScanning')}</Text>
          </TouchableOpacity>
          {getScanState().scanMode === 'step' ? (
            <>
              <TouchableOpacity onPress={advanceScan} style={[styles.scanOptionBtn, { backgroundColor: palette.info }]}
                accessibilityRole="button" accessibilityLabel={t('scanNext')}>
                <Text style={[styles.scanOptionText, { color: palette.buttonText }]}>{t('scanNext')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={selectCurrent} style={[styles.scanOptionBtn, { backgroundColor: palette.primary }]}
                accessibilityRole="button" accessibilityLabel={t('scanSelect')}>
                <Text style={[styles.scanOptionText, { color: palette.buttonText }]}>{t('scanSelect')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.scanHintText, { color: palette.text }]}>{t('scanningSelectHint')}</Text>
          )}
        </View>
      )}

      <MoreActionsMenu
        visible={showMore}
        onClose={() => setShowMore(false)}
        items={moreItems}
        voicePreset={voicePreset}
        onSelectVoicePreset={setVoicePreset}
      />

      {/* Vocabulary grid */}
      <FlatList
        data={currentPage.buttons}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        contentContainerStyle={[styles.grid, compact && scanActive && { paddingBottom: 150 }]}
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
    paddingBottom: 4,
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyPanel: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  panelScroll: { maxHeight: 260 },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  rowIconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  sentenceActionsCompact: { flexWrap: 'nowrap', justifyContent: 'space-between' },
  breadcrumbCompact: { gap: 6, paddingVertical: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scanStrip: {
    position: 'absolute', left: 8, right: 8, zIndex: 15,
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6,
    borderRadius: 12, borderWidth: 2,
  },
  scanHintText: { flex: 1, fontSize: 13, fontWeight: '600' },
  speechNotice: {
    position: 'absolute', left: 12, right: 12, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, opacity: 0.95,
  },
  speechNoticeText: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  suggestionsEmpty: { fontSize: 13, fontStyle: 'italic' },
  findBtn: { marginLeft: 'auto' },
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
    paddingVertical: 2,
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
    paddingVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
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
    minHeight: 44,
    borderRadius: 6,
    gap: 4,
  },
  breadcrumbText: { fontSize: 14, fontWeight: '500' },
  pageTitle: { fontSize: 16, fontWeight: '600', marginLeft: 4, flexShrink: 1 },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 16,
    gap: 4,
  },
  scanToggleText: { fontSize: 13, fontWeight: '600' },
  scanOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
  },
  scanOptionText: { fontSize: 12, fontWeight: '600' },
});
