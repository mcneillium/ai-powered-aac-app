// src/screens/AACBoardScreen.js
// The primary AAC communication screen.
//
// Design principles:
// 1. OFFLINE-FIRST: Works without internet using local core vocabulary
// 2. MOTOR-PLAN STABLE: Button positions never change unless the user edits
//    the board or the grid size. Child/Adult, symbols, suggestions, panels and
//    the situation never move a word: panels open as sheets over the board,
//    and the suggestion row has a fixed height and a fixed number of slots.
// 3. ACCESSIBLE: Every button has proper accessibility labels and roles
// 4. LOW-LATENCY: Speech fires immediately on tap with no network dependency
// 5. Fitzgerald Key colour coding (a colour cap on every tile)
// 6. Suggestions: built-in + (opt-in) learned on this device, tap to add
// 7. Favourites, history, situations and "Help me explain" one tap away

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import { getPalette, getExperience, symbolsOn, fonts, radii } from '../theme';
import { speak, stop, buildSpeechOptions, subscribeSpeechStatus } from '../services/speechService';
import { getHomePage, getPage, getPageIds } from '../data/coreVocabulary';
import { getContextPack } from '../data/contextPacks';
import { symbolFor } from '../data/symbols';
import { getAISuggestions } from '../services/getAISuggestions';
import { rank, placeInSlots, displayForm, norm } from '../services/predictionEngine';
import { useScrollToTopOnChange } from '../hooks/useScrollToTopOnChange';
import { suggestionChipFit } from '../utils/suggestionChipFit';
import { saveSentenceDraft, takeSentenceDraftAfterFontChange } from '../services/sentenceDraft';
import { t } from '../i18n/strings';
import {
  recordWordSelection,
  recordSentenceSpoken,
  recordSuggestionsShown,
  recordSourceShown,
  recordFailedSearch,
  getPersonalModel,
  getBlockedSuggestions,
  blockSuggestion,
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
import WordFinder from '../components/WordFinder';
import MoreActionsMenu from '../components/MoreActionsMenu';
import Sheet, { useAfterClose } from '../components/Sheet';
import ContextPanel from '../components/ContextPanel';
import HelpMeExplain from '../components/HelpMeExplain';
import VocabTile from '../components/board/VocabTile';
import SuggestionRow from '../components/board/SuggestionRow';
import { tabBarSpace } from '../components/tabBarMetrics';
import { openQuickPhrases, setQuickPhrasesButtonHidden } from '../components/QuickRepairOverlay';
import {
  setScanItems, setScanMode, setScanSpeed, getScanState,
  onScanChange, onScanSelect, startScan, stopScan,
  advanceScan, selectCurrent, cleanup as cleanupScan,
} from '../services/switchScanService';

// The suggestion row always has this many slots.
export const SUGGESTION_SLOTS = 4;
const EMPTY_SLOTS = new Array(SUGGESTION_SLOTS).fill(null);

// Every word on every page (lower case) and its board spelling, so learned
// and model suggestions are real vocabulary shown the way the board shows it.
function buildBoardVocabulary() {
  const casing = new Map();
  for (const id of getPageIds()) {
    const page = getPage(id);
    if (!page) continue;
    for (const b of page.buttons) {
      if (b.navigateTo) continue;
      const k = norm(b.label);
      if (!casing.has(k)) casing.set(k, b.label);
    }
  }
  return casing;
}

export default function AACBoardScreen() {
  const { settings, updateSettings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const showSymbols = symbolsOn(settings);
  const navigation = useNavigation();

  const [sentenceWords, setSentenceWords] = useState([]);
  const [currentPageId, setCurrentPageId] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);
  const [slots, setSlots] = useState(EMPTY_SLOTS);
  const [suggestionRefresh, setSuggestionRefresh] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [showSituations, setShowSituations] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
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
  const sentenceScrollRef = useRef(null);
  const gridRef = useRef(null);
  const slotsRef = useRef(EMPTY_SLOTS);

  // The board has its own Quick Phrases button in the header; hide the
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const boardCasing = useMemo(() => buildBoardVocabulary(), [isFocused]);
  // Every page opens with its first row in the same place.
  useScrollToTopOnChange(gridRef, currentPageId);
  const aiEnabled = settings.aiPersonalisationEnabled !== false;
  const learningOn = settings.localLearning === true;
  const cloudEnabled = settings.cloudSuggestionsEnabled !== false;
  const predictionEnabled = settings.predictionEnabled !== false;
  const speakWordsOnTap = settings.speakWordsOnTap !== false;
  const textScale = settings.textScale || 1;
  const { fontScale } = useWindowDimensions();
  const chipFit = suggestionChipFit({ textScale, fontScale });
  // Opt-in layout for small screens: hides the board header. Never switched
  // on automatically.
  const compact = settings.compactLayout === true;
  const situation = settings.activeSituation ? getContextPack(settings.activeSituation) : null;

  // One set of speech options for every utterance on this screen, so the
  // user's voice, speed and pitch (plus the chosen voice style) always apply.
  const speechOptions = useMemo(
    () => buildSpeechOptions(settings, voicePreset),
    [settings, voicePreset]
  );
  const say = useCallback((text) => speak(text, speechOptions), [speechOptions]);

  // Tell the user (once, non-blocking) when speech could not be produced.
  // The message itself stays on screen, so communication can continue by
  // showing it (Show on screen).
  useEffect(() => {
    let timer = null;
    const unsubscribe = subscribeSpeechStatus(({ error }) => {
      if (!error) {
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
  const scanItemList = useRef([]);
  const speakRef = useRef(null);
  const backspaceRef = useRef(null);
  const clearRef = useRef(null);
  const undoRef = useRef(null);
  const buttonPressRef = useRef(null);
  const suggestionPressRef = useRef(null);

  useEffect(() => {
    const vocabItems = currentPage.buttons.map(b => ({
      type: 'vocab', id: b.id, button: b, label: b.label,
    }));
    const suggItems = slots
      .map((s, i) => (s ? { type: 'suggestion', id: `sug-${i}`, word: s.word, label: s.display } : null))
      .filter(Boolean);
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
  }, [currentPage, slots, scanActive]);

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

  useEffect(() => {
    if (settings.scanMode) setScanMode(settings.scanMode);
    if (settings.scanSpeed) setScanSpeed(settings.scanSpeed);
  }, [settings.scanMode, settings.scanSpeed]);

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
  // Ranked locally (predictionEngine) into a fixed number of slots. Learned
  // evidence is only used when the user has switched learning on.
  useEffect(() => {
    let cancelled = false;
    if (!predictionEnabled) {
      slotsRef.current = EMPTY_SLOTS;
      setSlots(EMPTY_SLOTS);
      return undefined;
    }
    const vocabulary = new Set(boardCasing.keys());
    const show = (modelWords) => {
      const ranked = rank({
        context: sentenceWords,
        model: learningOn ? getPersonalModel() : null,
        learning: learningOn,
        modelWords,
        vocabulary,
        blocked: getBlockedSuggestions(),
        limit: 8,
      }).map(r => ({ ...r, display: displayForm(r.word, boardCasing) }));
      const next = placeInSlots(slotsRef.current, ranked, SUGGESTION_SLOTS);
      slotsRef.current = next;
      setSlots(next);
      return next;
    };
    show([]);

    (async () => {
      if (sentenceWords.length === 0) return;
      // Bundled neural model (offline, not personal): extra candidates.
      try {
        const aiResults = await getAISuggestions(sentenceWords.join(' '));
        if (!cancelled && aiResults.length > 0) {
          const shown = show(aiResults);
          if (learningOn) {
            recordSourceShown('neural', shown.filter(Boolean).length);
            recordSuggestionsShown(shown.filter(Boolean).length).catch(() => {});
          }
        }
      } catch {
        // Built-in suggestions are already showing.
      }

      // Online phrase suggestions (opt-in privacy setting): only ever fill
      // empty slots, never replace a word the user can see.
      if (aiEnabled && cloudEnabled && sentenceWords.length >= 2) {
        try {
          const recentTexts = getSentenceHistory().slice(0, 3).map(h => h.text);
          const vertexPhrases = await getAACPhraseSuggestions(sentenceWords, recentTexts);
          if (!cancelled && vertexPhrases.length > 0) {
            const current = slotsRef.current.slice();
            const have = new Set(current.filter(Boolean).map(s => s.word));
            const extra = vertexPhrases.filter(p => !have.has(norm(p)));
            for (let i = 0; i < current.length && extra.length; i++) {
              if (!current[i]) {
                const p = extra.shift();
                current[i] = { word: p, display: p, source: 'online', reason: 'online' };
              }
            }
            slotsRef.current = current;
            setSlots(current);
          }
        } catch {
          // Online suggestions are optional
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceWords, learningOn, aiEnabled, cloudEnabled, predictionEnabled, boardCasing, suggestionRefresh]);

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

  // Learning (opt-in, on this device): each word, in context.
  const learnWords = useCallback((prev, words, wasSuggestion) => {
    if (!learningOn) return;
    let ctx = prev;
    words.forEach((w) => {
      recordWordSelection(w, ctx, wasSuggestion).catch(() => {});
      ctx = [...ctx, w];
    });
  }, [learningOn]);

  const addWords = useCallback((words, wasSuggestion = false) => {
    setUndoWords(null);
    setSentenceWords(prev => {
      learnWords(prev, words, wasSuggestion);
      return [...prev, ...words];
    });
  }, [learnWords]);

  const addWord = useCallback((label, wasSuggestion = false) => {
    addWords([label], wasSuggestion);
    if (speakWordsOnTap) say(label);
  }, [addWords, say, speakWordsOnTap]);

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
    const shown = displayForm(word, boardCasing);
    const words = shown.split(' ');
    if (words.length > 1) {
      addWords(words, true);
      if (speakWordsOnTap) say(shown);
    } else {
      addWord(shown, true);
    }
  }, [addWord, addWords, say, speakWordsOnTap, boardCasing]);

  const handleSuggestionLongPress = useCallback((word) => {
    const shown = displayForm(word, boardCasing);
    Alert.alert(
      `Stop suggesting "${shown}"?`,
      'It stays on the board. You can undo this in Settings › Learning.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: "Don't suggest",
          onPress: () => {
            blockSuggestion(word)
              .then(() => setSuggestionRefresh(n => n + 1))
              .catch(() => {});
          },
        },
      ]
    );
  }, [boardCasing]);

  const speakSentence = useCallback(async () => {
    const text = sentenceWords.join(' ');
    if (text.trim()) {
      say(text);
      setLastSpoken(text);
      if (learningOn) recordSentenceSpoken(sentenceWords).catch(() => {});

      await addSentenceToHistory(text);
      setHistory([...getSentenceHistory()]);
    }
  }, [sentenceWords, learningOn, say]);

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

  // A whole phrase (favourite, situation phrase): put it in the message bar
  // and speak it.
  const speakPhrase = useCallback((phrase) => {
    replaceSentence(phrase.split(' '));
    say(phrase);
    setLastSpoken(phrase);
    addSentenceToHistory(phrase)
      .then(() => setHistory([...getSentenceHistory()]))
      .catch(() => {});
  }, [replaceSentence, say]);

  // Help me explain: "Use" puts the message in the bar to check first.
  const applyExplanation = useCallback((text) => {
    replaceSentence(text.split(' '));
  }, [replaceSentence]);

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
    if (learningOn) recordFailedSearch(term).catch(() => {});
  }, [learningOn]);

  const chooseSituation = useCallback((id) => {
    updateSettings({ activeSituation: id });
  }, [updateSettings]);

  const numColumns = settings.gridSize || 4;
  const currentSentenceText = sentenceWords.join(' ').trim();
  const isCurrentFavourite = currentSentenceText ? isFavourite(currentSentenceText) : false;

  const renderButton = useCallback(({ item }) => (
    <VocabTile
      item={item}
      onPress={handleButtonPress}
      palette={palette}
      theme={settings.theme}
      experience={experience}
      showSymbol={showSymbols}
      symbol={showSymbols ? symbolFor(item) : null}
      textScale={textScale}
      numColumns={numColumns}
      focused={isScanFocused('vocab', item.id)}
      focusStyle={scanRingStyle}
    />
  ), [handleButtonPress, palette, settings.theme, experience, showSymbols, textScale, numColumns, isScanFocused, scanRingStyle]);

  const hasWords = sentenceWords.length > 0;
  // Same size in both modes, so the message card (and the board) keep their height.
  const sentenceFont = Math.round(24 * textScale);
  const sentenceLineHeight = Math.round(sentenceFont * 1.3);
  const isHome = currentPageId === 'home';
  const bottomSpace = tabBarSpace(insets.bottom);

  // Square action button in the message card.
  const actionButton = ({ onPress, icon, label, disabled, scanId, tone = 'plain' }) => {
    const bg = palette.surface;
    const fg = tone === 'danger' ? palette.danger : palette.text;
    const focused = scanId && isScanFocused('action', scanId);
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.squareBtn, { backgroundColor: bg, borderRadius: experience.chipRadius }, disabled && styles.disabled, focused && scanRingStyle]}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled, selected: !!focused }}
      >
        <Ionicons name={icon} size={24} color={fg} />
      </TouchableOpacity>
    );
  };

  const headerIcon = ({ onPress, icon, label, active }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.headerBtn, { backgroundColor: active ? palette.focusRing : palette.cardBg, borderColor: palette.tileBorder }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <Ionicons name={icon} size={22} color={active ? '#000' : palette.text} />
    </TouchableOpacity>
  );

  const situationChip = (
    <TouchableOpacity
      onPress={() => setShowSituations(true)}
      style={[styles.situationChip, { backgroundColor: situation ? palette.primaryMuted : palette.cardBg, borderColor: situation ? palette.primaryMuted : palette.tileBorder }]}
      accessibilityRole="button"
      accessibilityLabel={situation ? `Situation: ${situation.label}. Open its phrases` : 'Choose a situation'}
    >
      <Ionicons name={situation ? situation.icon : 'compass-outline'} size={18} color={situation ? palette.onPrimaryMuted : palette.text} />
      <Text style={[styles.situationText, { color: situation ? palette.onPrimaryMuted : palette.text }]} numberOfLines={1}>
        {situation ? situation.label : 'Situation'}
      </Text>
      <Ionicons name="chevron-down" size={16} color={situation ? palette.onPrimaryMuted : palette.textSecondary} />
    </TouchableOpacity>
  );

  const moreItems = [
    { key: 'favs', icon: 'star', label: t('showFavourites'), onPress: () => setShowFavourites(true) },
    { key: 'history', icon: 'time-outline', label: t('showHistory'), onPress: () => setShowHistory(true) },
    {
      key: 'favToggle', icon: isCurrentFavourite ? 'star' : 'star-outline',
      label: isCurrentFavourite ? t('removeFromFavourites') : t('addToFavourites'),
      onPress: handleToggleFavourite, disabled: !hasWords,
    },
    { key: 'display', icon: 'tv-outline', label: t('showOnScreen'), onPress: () => setDisplayMode('display'), disabled: !hasWords },
    { key: 'explain', icon: 'extension-puzzle-outline', label: 'Help me explain', onPress: () => setShowExplain(true) },
    { key: 'situations', icon: 'compass-outline', label: 'Situations', onPress: () => setShowSituations(true) },
    { key: 'camera', icon: 'camera-outline', label: t('openCamera'), onPress: () => navigation.navigate('Camera') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Header: name, situation, quick phrases, settings (hidden in compact) */}
      {!compact && (
        <View style={styles.header}>
          <Text
            style={[styles.wordmark, { color: palette.text, fontFamily: experience.headlineFont }]}
            accessibilityRole="header"
          >
            {t('appName')}
          </Text>
          {situationChip}
          {headerIcon({ onPress: openQuickPhrases, icon: 'flash', label: t('quickPhrasesLabel') })}
          {headerIcon({ onPress: () => navigation.navigate('Settings'), icon: 'settings-outline', label: 'Open settings' })}
        </View>
      )}

      {/* Message card: the words, then Speak and the editing actions in a
          fixed order so their positions never move. */}
      <View style={[styles.messageCard, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.tileRadius + 4 }]}>
        <ScrollView
          ref={sentenceScrollRef}
          style={{ height: compact ? sentenceLineHeight + 6 : sentenceLineHeight * 2 + 6 }}
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
            <Text style={[styles.placeholder, { color: palette.textSecondary, fontSize: Math.round(18 * textScale), lineHeight: sentenceLineHeight }]}>
              {experience.id === 'child' ? 'Tap the words to talk' : t('tapToSpeak')}
            </Text>
          ) : (
            sentenceWords.map((word, i) => (
              <Text
                key={`${i}-${word}`}
                style={[styles.sentenceWord, { color: palette.text, fontSize: sentenceFont, lineHeight: sentenceLineHeight }]}
              >
                {word}
              </Text>
            ))
          )}
        </ScrollView>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={speakSentence}
            disabled={!hasWords}
            style={[
              styles.speakBtn,
              { backgroundColor: palette.primary, borderRadius: experience.chipRadius },
              !hasWords && styles.disabled,
              isScanFocused('action', 'speak') && scanRingStyle,
            ]}
            accessibilityRole="button"
            accessibilityLabel={hasWords ? `Speak sentence: ${sentenceWords.join(' ')}` : 'Speak button. Build a sentence first.'}
            accessibilityState={{ disabled: !hasWords, selected: isScanFocused('action', 'speak') }}
          >
            <Ionicons name="volume-high" size={24} color={palette.buttonText} />
            <Text
              style={[styles.speakText, { color: palette.buttonText, fontFamily: experience.headlineFont }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.4}
            >
              {experience.speakLabel}
            </Text>
          </TouchableOpacity>
          {actionButton({ onPress: undo, icon: 'arrow-undo-outline', label: undoWords ? t('undoLabel') : t('nothingToUndo'), disabled: !undoWords, scanId: 'undo' })}
          {actionButton({ onPress: removeLastWord, icon: 'backspace-outline', label: t('deleteLastWord'), disabled: !hasWords, scanId: 'backspace', tone: 'danger' })}
          {actionButton({ onPress: clearSentence, icon: 'close', label: t('clearSentence'), disabled: !hasWords, scanId: 'clear', tone: 'danger' })}
          {actionButton({ onPress: () => setShowMore(true), icon: 'ellipsis-horizontal', label: t('moreActionsLabel') })}
        </View>
      </View>

      {/* Fixed suggestion area */}
      {predictionEnabled && (
        <SuggestionRow
          slots={slots}
          palette={palette}
          experience={experience}
          textScale={textScale}
          chipFit={chipFit}
          onPress={handleSuggestionPress}
          onLongPress={handleSuggestionLongPress}
          isFocused={(i) => isScanFocused('suggestion', `sug-${i}`)}
          focusStyle={scanRingStyle}
          learningOn={learningOn}
        />
      )}

      {/* Page row — always present (also on Home) so the grid starts at the
          same place on every page. */}
      <View style={styles.pageRow}>
        <TouchableOpacity
          onPress={goHome}
          disabled={isHome}
          style={[styles.pageBtn, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }, isHome && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('goHome')}
          accessibilityState={{ disabled: isHome }}
        >
          <Ionicons name="home-outline" size={20} color={palette.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goBack}
          disabled={pageHistory.length === 0}
          style={[styles.pageBtn, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }, pageHistory.length === 0 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('goBack')}
          accessibilityState={{ disabled: pageHistory.length === 0 }}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: palette.text, fontFamily: experience.headlineFont }]} numberOfLines={1} accessibilityRole="header">
          {currentPage.label}
        </Text>
        {compact && (
          <TouchableOpacity
            onPress={() => setShowSituations(true)}
            style={[styles.pageBtn, { backgroundColor: situation ? palette.primaryMuted : palette.cardBg, borderColor: palette.tileBorder }]}
            accessibilityRole="button"
            accessibilityLabel={situation ? `Situation: ${situation.label}. Open its phrases` : 'Choose a situation'}
          >
            <Ionicons name={situation ? situation.icon : 'compass-outline'} size={20} color={situation ? palette.onPrimaryMuted : palette.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowFinder(true)}
          style={[styles.pageBtn, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }]}
          accessibilityRole="button"
          accessibilityLabel={t('findWordLabel')}
        >
          <Ionicons name="search" size={20} color={palette.text} />
        </TouchableOpacity>
        {settings.showScanControls !== false && (
          <TouchableOpacity
            onPress={toggleScan}
            style={[styles.pageBtn, { backgroundColor: scanActive ? palette.focusRing : palette.cardBg, borderColor: palette.tileBorder }]}
            accessibilityRole="button"
            accessibilityLabel={scanActive ? t('stopScanning') : t('startScanning')}
            accessibilityState={{ selected: scanActive }}
          >
            <Ionicons name={scanActive ? 'stop' : 'scan-outline'} size={20} color={scanActive ? '#000' : palette.text} />
          </TouchableOpacity>
        )}
        {compact && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={[styles.pageBtn, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={20} color={palette.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Vocabulary grid */}
      <FlatList
        ref={gridRef}
        data={currentPage.buttons}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomSpace + (scanActive ? 84 : 12) }]}
        renderItem={renderButton}
        extraData={scanFocusIndex}
        removeClippedSubviews={false}
      />

      {/* Speech problem notice — overlays (does not move the grid) and lets
          taps pass through to the buttons underneath. */}
      {speechProblem && (
        <View
          pointerEvents="none"
          style={[styles.speechNotice, { backgroundColor: palette.text, bottom: bottomSpace + (scanActive ? 76 : 8) }]}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          <Ionicons name="volume-mute-outline" size={20} color={palette.background} />
          <Text style={[styles.speechNoticeText, { color: palette.background }]}>
            {speechProblem === 'unavailable' ? t('speechUnavailable') : t('speechFailed')}
          </Text>
        </View>
      )}

      {/* Scanning strip: overlays the bottom of the grid instead of inserting
          a row, so words do not move when scanning starts. */}
      {scanActive && (
        <View style={[styles.scanStrip, { backgroundColor: palette.cardBg, borderColor: palette.focusRing, bottom: bottomSpace }]}>
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

      <MoreActionsMenu
        visible={showMore}
        onClose={() => setShowMore(false)}
        items={moreItems}
        voicePreset={voicePreset}
        onSelectVoicePreset={setVoicePreset}
      />

      <PhraseListSheet
        visible={showFavourites}
        onClose={() => setShowFavourites(false)}
        title={`${t('favourites')}${favourites.length ? ` (${favourites.length})` : ''}`}
        icon="⭐"
        empty={t('noFavourites')}
        palette={palette}
        experience={experience}
        items={favourites.map(f => ({ key: f.id, text: f.phrase, fav: f }))}
        onPick={(item) => speakPhrase(item.text)}
        pickLabel={(item) => `Speak favourite: ${item.text}`}
        onRemove={(item) => confirmRemoveFavourite(item.fav)}
        removeLabel={(item) => `${t('removeFavourite')}: ${item.text}`}
      />

      <PhraseListSheet
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        title={t('sentenceHistory')}
        icon="🕘"
        empty={t('noHistory')}
        palette={palette}
        experience={experience}
        items={history.map((h, i) => ({ key: `${i}-${h.timestamp}`, text: h.text, count: h.speakCount || 0 }))}
        onPick={(item) => repeatFromHistory(item.text)}
        pickLabel={(item) => `Repeat: ${item.text}`}
      />

      <ContextPanel
        visible={showSituations}
        onClose={() => setShowSituations(false)}
        palette={palette}
        experience={experience}
        situationId={settings.activeSituation}
        onChooseSituation={chooseSituation}
        onUsePhrase={speakPhrase}
        onHelpExplain={() => setShowExplain(true)}
      />

      <HelpMeExplain
        visible={showExplain}
        onClose={() => setShowExplain(false)}
        palette={palette}
        experience={experience}
        onUse={applyExplanation}
        onSpeak={speakPhrase}
      />
    </View>
  );
}

// Favourites / history list in a sheet. Picking a phrase closes the sheet,
// puts the phrase in the message bar and speaks it.
function PhraseListSheet({
  visible, onClose, title, icon, empty, palette, experience, items, onPick, pickLabel, onRemove, removeLabel,
}) {
  const { closeThen, onDismiss } = useAfterClose(onClose);
  return (
    <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} title={title} icon={icon}>
      {items.length === 0 ? (
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{empty}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.listBody}>
          {items.map((item) => (
            <View key={item.key} style={[styles.listItem, { backgroundColor: palette.cardBg, borderColor: palette.tileBorder, borderRadius: experience.chipRadius }]}>
              <TouchableOpacity
                style={styles.listMain}
                onPress={() => closeThen(() => onPick(item))}
                accessibilityRole="button"
                accessibilityLabel={pickLabel(item)}
              >
                <Ionicons name="volume-high-outline" size={20} color={palette.primary} />
                <Text style={[styles.listText, { color: palette.text }]} numberOfLines={2}>{item.text}</Text>
                {item.count > 1 ? (
                  <Text style={[styles.listCount, { color: palette.textSecondary }]}>{item.count}×</Text>
                ) : null}
              </TouchableOpacity>
              {onRemove ? (
                <TouchableOpacity
                  style={styles.listRemove}
                  onPress={() => onRemove(item)}
                  accessibilityRole="button"
                  accessibilityLabel={removeLabel(item)}
                >
                  <Ionicons name="close-circle-outline" size={24} color={palette.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8,
  },
  wordmark: { fontSize: 26, marginRight: 'auto', letterSpacing: -0.3 },
  headerBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  situationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 14,
    borderRadius: radii.pill, borderWidth: 1, maxWidth: 170,
  },
  situationText: { fontSize: 16, fontFamily: fonts.bold, flexShrink: 1 },
  messageCard: {
    marginHorizontal: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    borderWidth: 1,
    shadowColor: '#1F2433', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  sentenceWords: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  sentenceWord: { fontFamily: fonts.bold, marginRight: 8 },
  placeholder: { fontFamily: fonts.regular },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  speakBtn: {
    flex: 1, height: 56, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  speakText: { fontSize: 20 },
  squareBtn: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  pageBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, fontSize: 20, marginLeft: 4 },
  grid: { paddingHorizontal: 8, paddingTop: 2 },
  scanStrip: {
    position: 'absolute', left: 8, right: 8, zIndex: 15,
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6,
    borderRadius: 14, borderWidth: 2,
  },
  scanHintText: { flex: 1, fontSize: 14, fontFamily: fonts.bold },
  scanOptionBtn: {
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, borderRadius: 12, justifyContent: 'center',
  },
  scanOptionText: { fontSize: 14, fontFamily: fonts.bold },
  speechNotice: {
    position: 'absolute', left: 12, right: 12, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, opacity: 0.95,
  },
  speechNoticeText: { flex: 1, fontSize: 15, fontFamily: fonts.bold, lineHeight: 20 },
  emptyText: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, paddingVertical: 8 },
  listBody: { gap: 8, paddingBottom: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 56 },
  listMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 56 },
  listText: { flex: 1, fontSize: 18, fontFamily: fonts.bold },
  listCount: { fontSize: 14, fontFamily: fonts.regular },
  listRemove: { width: 52, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});
