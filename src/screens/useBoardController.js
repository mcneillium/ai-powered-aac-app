// src/screens/useBoardController.js
// Everything the communication board does, independent of how it looks:
// the sentence, pages, speech, suggestions, Undo, favourites, history,
// find-a-word and switch scanning. Both the familiar Classic board
// (AACBoardScreen) and the new board (StudioBoardScreen) use it, so they
// behave identically and fixes apply to both.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, useWindowDimensions } from 'react-native';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette } from '../theme';
import { speak, stop, buildSpeechOptions, subscribeSpeechStatus } from '../services/speechService';
import { getHomePage, getPage } from '../data/coreVocabulary';
import {
  suggestNext, learnFromSpoken, suggestionAccepted, subscribePrediction, setLearningEnabled,
} from '../services/suggestionEngine';
import { useScrollToTopOnChange } from '../hooks/useScrollToTopOnChange';
import { suggestionChipFit } from '../utils/suggestionChipFit';
import { saveSentenceDraft, takeSentenceDraftAfterFontChange } from '../services/sentenceDraft';
import { t } from '../i18n/strings';
import {
  recordWordSelection,
  recordSentenceSpoken,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setQuickPhrasesButtonHidden } from '../components/QuickRepairOverlay';
import {
  setScanItems, setScanMode, setScanSpeed, getScanState,
  onScanChange, onScanSelect, startScan, stopScan,
  cleanup as cleanupScan,
} from '../services/switchScanService';

/**
 * @param {object} [options]
 * @param {boolean} [options.modelling] A supporter is demonstrating words
 *   (Child modelling). Nothing is learned and nothing is added to history.
 */
export function useBoardController({ modelling = false } = {}) {
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
  const gridRef = useRef(null);

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
  // Every page opens with its first row in the same place.
  useScrollToTopOnChange(gridRef, currentPageId);
  // Learning from use is off until the user turns on personal learning, and
  // always paused while someone is modelling.
  const aiEnabled = settings.personalLearning === true
    && settings.aiPersonalisationEnabled !== false
    && !modelling;
  const cloudEnabled = settings.cloudSuggestionsEnabled === true;
  const predictionEnabled = settings.predictionEnabled !== false;
  const speakWordsOnTap = settings.speakWordsOnTap !== false;
  const textScale = settings.textScale || 1;
  const { fontScale } = useWindowDimensions();
  const chipFit = suggestionChipFit({ textScale, fontScale });
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

  // Changing the system font size reloads the app in place (Android); bring
  // back the sentence and page the user had, then keep the draft current.
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    let alive = true;
    takeSentenceDraftAfterFontChange()
      .then((draft) => {
        if (!alive || !draft) return;
        setSentenceWords((prev) => (prev.length > 0 ? prev : draft.words));
        if (draft.pageId !== 'home' && getPage(draft.pageId)) setCurrentPageId(draft.pageId);
      })
      .finally(() => { if (alive) setDraftReady(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (draftReady) saveSentenceDraft(sentenceWords, currentPageId);
  }, [draftReady, sentenceWords, currentPageId]);

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

  // ── Suggestions ──
  // On-device prediction (src/services/prediction): synchronous and offline,
  // so the suggestion row updates in the same render pass as the message.
  // Suggestions are only ever added on an explicit tap. They never reorder
  // the board. The optional online phrase service (off unless the user
  // turns on Online suggestions) can add phrases afterwards.
  const [predictionTick, setPredictionTick] = useState(0);
  useEffect(() => subscribePrediction(() => setPredictionTick(n => n + 1)), []);
  useEffect(() => { setLearningEnabled(settings.personalLearning === true && !modelling); },
    [settings.personalLearning, modelling]);
  useEffect(() => {
    let cancelled = false;
    if (!predictionEnabled) {
      setSuggestions([]);
      return undefined;
    }
    const local = suggestNext(sentenceWords, {
      context: settings.activeContext, mode: settings.uiMode || undefined, k: 6,
    });
    setSuggestions(local);

    if (cloudEnabled && settings.personalLearning === true && !modelling && sentenceWords.length >= 2) {
      (async () => {
        try {
          const recentTexts = getSentenceHistory().slice(0, 3).map(h => h.text);
          const vertexPhrases = await getAACPhraseSuggestions(sentenceWords, recentTexts);
          if (!cancelled && vertexPhrases.length > 0) {
            setSuggestions(prev => {
              const existing = prev.map(x => x.word);
              const extra = vertexPhrases.filter(ph => !existing.includes(ph)).map(ph => ({ word: ph, reason: 'online suggestion' }));
              return [...prev, ...extra].slice(0, 8);
            });
          }
        } catch {
          // Online suggestions are optional
        }
      })();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceWords, cloudEnabled, predictionEnabled, settings.activeContext, settings.uiMode, settings.personalLearning, modelling, predictionTick]);

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

  // Taps never train anything: a word that is later deleted must not be
  // learned. Learning happens when a message is spoken (speakSentence).
  const addWord = useCallback((label, wasSuggestion = false) => {
    setUndoWords(null);
    setSentenceWords(prev => {
      if (wasSuggestion && aiEnabled) suggestionAccepted(label, prev);
      return [...prev, label];
    });
    if (speakWordsOnTap) say(label);
  }, [aiEnabled, say, speakWordsOnTap]);

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
      if (aiEnabled) {
        // Only spoken messages are evidence of what the user means to say.
        learnFromSpoken(sentenceWords);
        sentenceWords.forEach((w, i) => recordWordSelection(w, sentenceWords.slice(0, i), false).catch(() => {}));
        recordSentenceSpoken(sentenceWords).catch(() => {});
      }

      if (modelling) return; // demonstrations are not the user's own messages
      await addSentenceToHistory(text);
      setHistory([...getSentenceHistory()]);
    }
  }, [sentenceWords, aiEnabled, say, modelling]);

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

  return {
    settings,
    palette,
    navigation,
    sentenceWords,
    setSentenceWords,
    currentPageId,
    setCurrentPageId,
    pageHistory,
    setPageHistory,
    suggestions,
    setSuggestions,
    showHistory,
    setShowHistory,
    showFavourites,
    setShowFavourites,
    history,
    setHistory,
    favourites,
    setFavourites,
    voicePreset,
    setVoicePreset,
    displayMode,
    setDisplayMode,
    lastSpoken,
    setLastSpoken,
    scanActive,
    setScanActive,
    scanFocusIndex,
    setScanFocusIndex,
    undoWords,
    setUndoWords,
    showFinder,
    setShowFinder,
    showMore,
    setShowMore,
    insets,
    speechProblem,
    setSpeechProblem,
    sentenceBarRef,
    sentenceScrollRef,
    gridRef,
    isFocused,
    currentPage,
    aiEnabled,
    cloudEnabled,
    predictionEnabled,
    speakWordsOnTap,
    textScale,
    fontScale,
    chipFit,
    compact,
    speechOptions,
    say,
    draftReady,
    setDraftReady,
    scanItemList,
    speakRef,
    backspaceRef,
    clearRef,
    undoRef,
    buttonPressRef,
    suggestionPressRef,
    updateSettings,
    toggleScan,
    changeScanMode,
    changeScanSpeed,
    isScanFocused,
    scanRingStyle,
    navigateToPage,
    goBack,
    goHome,
    replaceSentence,
    addWords,
    addWord,
    handleButtonPress,
    handleSuggestionPress,
    speakSentence,
    removeLastWord,
    clearSentence,
    undo,
    repeatFromHistory,
    handleToggleFavourite,
    confirmRemoveFavourite,
    speakFavourite,
    handleFinderAdd,
    handleFinderShowPage,
    handleFinderNoResults,
    numColumns,
    currentSentenceText,
    isCurrentFavourite,
  };
}
