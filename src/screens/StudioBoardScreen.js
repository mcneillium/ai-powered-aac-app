// src/screens/StudioBoardScreen.js
// The Voice 2 communication board ("Paper & Ink").
//
// Same behaviour as the Classic board (useBoardController); new composition:
// 1. Message stage — the message in large type with Speak/Stop, Delete,
//    Clear and Undo as separate, fixed controls.
// 2. Tool row — Explain, Phrases, Saved, Show: fixed positions.
// 3. Suggestion row — fixed height, dashed chips (always read as suggestions).
// 4. Page row and the word grid. Nothing above the grid changes height while
//    composing, so learned word positions never move. Predictions never
//    reorder the grid.
// Optional: controls at the bottom for one-handed use; two-pane on tablets.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, useWindowDimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardController } from './useBoardController';
import { usePaper } from '../design/usePaper';
import { Tile, ActionButton, SuggestionChip, ListRow, tileCategory } from '../design/components';
import { space, type, touch } from '../design/tokens';
import { subscribeSpeechStatus, getSpeechStatus, stop } from '../services/speechService';
import { symbolSourceFor, subscribeSymbols, loadSymbolState } from '../services/symbolStore';
import { getContextPack } from '../data/contextPacks';
import { dismissSuggestion } from '../services/suggestionEngine';
import { t } from '../i18n/strings';
import WordFinder from '../components/WordFinder';
import ExplainSheet from '../components/studio/ExplainSheet';
import PhrasesSheet from '../components/studio/PhrasesSheet';
import SavedSheet from '../components/studio/SavedSheet';
import ShowMessage from '../components/studio/ShowMessage';
import ModeSheet from '../components/studio/ModeSheet';
import MoreSheet from '../components/studio/MoreSheet';
import { advanceScan, selectCurrent, getScanState } from '../services/switchScanService';

export default function StudioBoardScreen() {
  const [modelling, setModelling] = useState(false);
  const b = useBoardController({ modelling });
  const {
    settings, navigation, sentenceWords, currentPage, currentPageId, pageHistory,
    suggestions, history, favourites, undoWords, showFinder, setShowFinder,
    speechProblem, gridRef, sentenceScrollRef, predictionEnabled, chipFit, scanActive,
    toggleScan, isScanFocused, goBack, goHome, handleButtonPress, handleSuggestionPress,
    speakSentence, removeLastWord, clearSentence, undo, replaceSentence, say,
    repeatFromHistory, speakFavourite, handleToggleFavourite, confirmRemoveFavourite,
    handleFinderAdd, handleFinderShowPage, handleFinderNoResults, isCurrentFavourite,
    voicePreset, setVoicePreset, updateSettings,
  } = b;
  const p = usePaper();
  const { c, r, mode, scale } = p;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  // Speaking state drives Speak ↔ Stop in the same position.
  const [speaking, setSpeaking] = useState(getSpeechStatus().speaking);
  useEffect(() => subscribeSpeechStatus((s) => setSpeaking(!!s.speaking)), []);

  // Re-render tiles when symbols finish downloading.
  const [symbolTick, setSymbolTick] = useState(0);
  useEffect(() => {
    loadSymbolState().catch(() => {});
    return subscribeSymbols(() => setSymbolTick((n) => n + 1));
  }, []);

  const [sheet, setSheet] = useState(null); // 'explain' | 'phrases' | 'saved' | 'show' | 'mode' | 'more'
  const close = useCallback(() => setSheet(null), []);

  const hasWords = sentenceWords.length > 0;
  const message = sentenceWords.join(' ');
  const symbolStyle = settings.symbolStyle || 'mixed';
  const controlsBottom = settings.controlsPosition === 'bottom' && !wide;
  const context = settings.activeContext ? getContextPack(settings.activeContext) : null;

  // ── Grid geometry ──
  const baseColumns = settings.gridSize || (mode === 'child' ? 3 : 4);
  const paneWidth = wide ? Math.min(420, width * 0.4) : 0;
  const gridWidth = width - paneWidth;
  const columns = wide ? Math.max(baseColumns, Math.floor(gridWidth / 150)) : baseColumns;
  const tileHeight = Math.round(
    (symbolStyle === 'text' ? 68 : symbolStyle === 'symbols' ? (mode === 'child' ? 116 : 104) : 88)
    * Math.min(scale, 1.5)
  );

  const renderTile = useCallback(({ item }) => {
    const isNav = !!item.navigateTo;
    return (
      <Tile
        button={item}
        height={tileHeight}
        symbolStyle={symbolStyle}
        symbolSource={symbolStyle === 'text' ? null : symbolSourceFor(item)}
        focused={isScanFocused('vocab', item.id)}
        onPress={() => handleButtonPress(item)}
        accessibilityLabel={isNav ? `Go to ${item.label} page` : `Say ${item.label}. ${tileCategory(item)}`}
        accessibilityHint={isNav ? 'Opens a new vocabulary page' : 'Adds this word to your message'}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileHeight, symbolStyle, isScanFocused, handleButtonPress, symbolTick]);

  // Long press on a suggestion offers to stop suggesting it here.
  const [chipMenu, setChipMenu] = useState(null);

  // ── Pieces ──
  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
      <Pressable
        onPress={() => setSheet('mode')}
        style={[styles.modePill, { backgroundColor: c.sunk, borderRadius: 999 }]}
        accessibilityRole="button"
        accessibilityLabel={`${mode === 'child' ? 'Child' : 'Adult'} mode${context ? `, ${context.label} phrases` : ''}. Change mode`}
      >
        <View style={[styles.brandDot, { backgroundColor: c.signal }]} />
        <Text style={[type.label, { color: c.ink }]}>Voice</Text>
        <Text style={[type.label, { color: c.inkSoft }]}> · {mode === 'child' ? 'Child' : 'Adult'}</Text>
        <Ionicons name="chevron-down" size={14} color={c.inkSoft} style={{ marginLeft: 2 }} />
      </Pressable>
      <View style={{ flex: 1 }} />
      {modelling && (
        <View style={[styles.modelTag, { backgroundColor: c.signalSoft, borderRadius: 999 }]} accessibilityLiveRegion="polite">
          <Ionicons name="school-outline" size={14} color={c.signal} />
          <Text style={[type.caption, { color: c.signal, marginLeft: 4 }]}>MODELLING</Text>
        </View>
      )}
      <ActionButton icon="search" a11yLabel={t('findWordLabel')} onPress={() => setShowFinder(true)} variant="ghost" size={touch.min} />
      <ActionButton icon="ellipsis-horizontal" a11yLabel="More options" onPress={() => setSheet('more')} variant="ghost" size={touch.min} />
      <ActionButton icon="settings-outline" a11yLabel="Open settings" onPress={() => navigation.navigate('Settings')} variant="ghost" size={touch.min} />
    </View>
  );

  const lineHeight = Math.round(type.message.lineHeight * scale);
  const stage = (
    <View style={[styles.stage, { backgroundColor: c.card, borderRadius: r.sheet, borderColor: c.line, borderWidth: p.theme === 'highContrast' ? 2 : 1 }]}>
      <ScrollView
        ref={sentenceScrollRef}
        style={{ height: lineHeight * 2 + 8 }}
        onContentSizeChange={() => sentenceScrollRef.current?.scrollToEnd({ animated: false })}
        accessible
        accessibilityRole="text"
        accessibilityLabel={hasWords ? `Message: ${message}` : 'Message is empty. Tap words to build a message.'}
        accessibilityLiveRegion="polite"
      >
        {hasWords ? (
          <Text style={[type.message, { color: c.ink, fontSize: Math.round(type.message.fontSize * scale), lineHeight }]}>
            {message}
            <Text style={{ color: c.signal, fontWeight: '300' }}>|</Text>
          </Text>
        ) : (
          <Text style={[type.message, { color: c.inkSoft, fontWeight: '500', fontSize: Math.round(22 * scale), lineHeight }]}>
            {modelling ? 'Show words by tapping them' : mode === 'child' ? 'Tap pictures to talk' : 'Tap words to build a message'}
          </Text>
        )}
      </ScrollView>
      <View style={styles.controls}>
        {speaking ? (
          <ActionButton
            icon="stop" label="Stop" variant="signal" flex={1} onPress={stop}
            a11yLabel="Stop speaking" focused={isScanFocused('action', 'speak')}
          />
        ) : (
          <ActionButton
            icon="volume-high" label="Speak" variant="signal" flex={1} onPress={speakSentence}
            disabled={!hasWords} focused={isScanFocused('action', 'speak')}
            a11yLabel={hasWords ? `Speak message: ${message}` : 'Speak. Build a message first.'}
          />
        )}
        <ActionButton icon="backspace-outline" a11yLabel={t('deleteLastWord')} onPress={removeLastWord} disabled={!hasWords} focused={isScanFocused('action', 'backspace')} />
        <ActionButton icon="close" a11yLabel={t('clearSentence')} onPress={clearSentence} disabled={!hasWords} variant="danger" focused={isScanFocused('action', 'clear')} />
        <ActionButton icon="arrow-undo" a11yLabel={undoWords ? t('undoLabel') : t('nothingToUndo')} onPress={undo} disabled={!undoWords} focused={isScanFocused('action', 'undo')} />
      </View>
    </View>
  );

  const tool = (icon, label, key, onPress, a11y) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y || label}
      style={({ pressed }) => [styles.tool, { backgroundColor: pressed ? c.signalSoft : c.sunk, borderRadius: r.control }, p.theme === 'highContrast' && { borderWidth: 2, borderColor: c.line }]}
    >
      <Ionicons name={icon} size={19} color={c.ink} />
      <Text style={[type.label, { color: c.ink, fontSize: 13, lineHeight: 16 }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
    </Pressable>
  );
  const tools = (
    <View style={styles.tools}>
      {tool('chatbubble-ellipses-outline', 'Explain', 'explain', () => setSheet('explain'), 'Help me explain')}
      {tool('albums-outline', context ? context.label : 'Phrases', 'phrases', () => setSheet('phrases'), `Phrases${context ? ` for ${context.label}` : ''}`)}
      {tool('star-outline', 'Saved', 'saved', () => setSheet('saved'), 'Saved and recent messages')}
      {tool('expand-outline', 'Show', 'show', () => setSheet('show'), t('showOnScreen'))}
    </View>
  );

  const suggestionRow = predictionEnabled ? (
    <View style={[styles.suggestRow, { height: touch.min + space.md }]} accessibilityLabel="Suggestions">
      <Ionicons name="sparkles-outline" size={16} color={c.inkSoft} style={{ marginRight: space.sm }} accessibilityElementsHidden importantForAccessibility="no" />
      {suggestions.length === 0 ? (
        <Text style={[type.body, { color: c.inkSoft }]} numberOfLines={1}>{t('suggestionsEmpty')}</Text>
      ) : (
        <FlatList
          data={suggestions}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${typeof item === 'string' ? item : item.word}-${i}`}
          renderItem={({ item, index }) => {
            const word = typeof item === 'string' ? item : item.word;
            return (
              <SuggestionChip
                word={word}
                reason={typeof item === 'string' ? null : item.reason}
                focused={isScanFocused('suggestion', `sug-${index}`)}
                maxFontSizeMultiplier={chipFit.wordMaxMultiplier}
                onPress={() => handleSuggestionPress(word)}
                onLongPress={() => setChipMenu(word)}
              />
            );
          }}
        />
      )}
    </View>
  ) : null;

  const isHome = currentPageId === 'home';
  const pageRow = (
    <View style={styles.pageRow}>
      <ActionButton icon="home-outline" a11yLabel={t('goHome')} onPress={goHome} disabled={isHome} size={touch.min} />
      <ActionButton icon="arrow-back" a11yLabel={t('goBack')} onPress={goBack} disabled={pageHistory.length === 0} size={touch.min} />
      <Text style={[type.heading, { color: c.ink, marginLeft: space.sm, flex: 1 }]} numberOfLines={1} accessibilityRole="header">
        {currentPage.label}
      </Text>
      {scanActive && (
        <ActionButton icon="stop-circle-outline" label="Stop scan" a11yLabel={t('stopScanning')} onPress={toggleScan} size={touch.min} />
      )}
    </View>
  );

  const grid = (
    <FlatList
      ref={gridRef}
      data={currentPage.buttons}
      keyExtractor={(item) => item.id}
      numColumns={columns}
      key={`grid-${columns}`}
      renderItem={renderTile}
      contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: scanActive ? 120 : space.lg }}
      extraData={`${b.scanFocusIndex}-${symbolStyle}-${symbolTick}`}
      removeClippedSubviews={false}
      style={{ flex: 1 }}
    />
  );

  const composer = (
    <View style={{ paddingHorizontal: space.md }}>
      {stage}
      {tools}
      {suggestionRow}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.paper }]}>
      {topBar}
      {wide ? (
        <View style={styles.wide}>
          <View style={{ width: paneWidth }}>
            {composer}
            <View style={{ paddingHorizontal: space.md }}>{pageRow}</View>
            {/* Tablets: recent messages one tap away in the spare column. */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.lg }}>
              <Text style={[type.caption, { color: c.inkSoft, marginTop: space.sm }]} accessibilityRole="header">RECENT</Text>
              {history.length === 0 ? (
                <Text style={[type.body, { color: c.inkSoft, marginTop: 4 }]}>Messages you speak appear here.</Text>
              ) : history.slice(0, 8).map((h, i) => (
                <ListRow key={`${i}-${h.timestamp}`} icon="refresh" text={h.text} onPress={() => repeatFromHistory(h.text)} a11yLabel={`Repeat: ${h.text}`} />
              ))}
            </ScrollView>
          </View>
          <View style={{ flex: 1 }}>{grid}</View>
        </View>
      ) : controlsBottom ? (
        <>
          <View style={{ paddingHorizontal: space.md }}>{pageRow}</View>
          {grid}
          {composer}
        </>
      ) : (
        <>
          {composer}
          <View style={{ paddingHorizontal: space.md }}>{pageRow}</View>
          {grid}
        </>
      )}

      {/* Speech notice: overlays (never moves the grid), taps pass through. */}
      {speechProblem && (
        <View pointerEvents="none" style={[styles.notice, { backgroundColor: c.ink, bottom: space.lg + (scanActive ? 84 : 0), borderRadius: r.control }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Ionicons name="volume-mute-outline" size={20} color={c.paper} />
          <Text style={[type.body, { color: c.paper, flex: 1, marginLeft: space.sm, fontWeight: '600' }]}>
            {speechProblem === 'unavailable' ? t('speechUnavailable') : t('speechFailed')}
          </Text>
        </View>
      )}

      {/* Scanning strip overlays the bottom so words do not move. */}
      {scanActive && (
        <View style={[styles.scanStrip, { backgroundColor: c.card, borderColor: c.focus, borderRadius: r.control }]}>
          <ActionButton label={t('stopScanning')} onPress={toggleScan} size={touch.min} />
          {getScanState().scanMode === 'step' ? (
            <>
              <ActionButton label={t('scanNext')} onPress={advanceScan} size={touch.min} flex={1} />
              <ActionButton label={t('scanSelect')} onPress={selectCurrent} variant="signal" size={touch.min} flex={1} />
            </>
          ) : (
            <Text style={[type.label, { color: c.ink, flex: 1, marginLeft: space.sm }]}>{t('scanningSelectHint')}</Text>
          )}
        </View>
      )}

      {/* Suggestion options (long press): correct a bad suggestion. */}
      {chipMenu && (
        <View style={[styles.chipMenu, { backgroundColor: c.card, borderColor: c.line, borderRadius: r.control }]} accessibilityViewIsModal>
          <Text style={[type.body, { color: c.ink, marginBottom: space.sm }]}>
            Stop suggesting “{chipMenu}” after “{sentenceWords[sentenceWords.length - 1] || 'the start'}”?
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <ActionButton label="Keep" onPress={() => setChipMenu(null)} flex={1} size={touch.min} />
            <ActionButton
              label="Don't suggest" variant="signal" flex={1} size={touch.min}
              onPress={() => { dismissSuggestion(chipMenu, sentenceWords, settings.activeContext); setChipMenu(null); b.refreshSuggestions?.(); }}
            />
          </View>
        </View>
      )}

      <WordFinder visible={showFinder} onClose={() => setShowFinder(false)} onAddWord={handleFinderAdd} onShowPage={handleFinderShowPage} onNoResults={handleFinderNoResults} />
      <ExplainSheet
        visible={sheet === 'explain'} onClose={close} message={message} say={say}
        onReplace={(text) => { replaceSentence(text.split(' ')); close(); }}
      />
      <PhrasesSheet
        visible={sheet === 'phrases'} onClose={close} mode={mode}
        activeContext={settings.activeContext}
        onChooseContext={(id) => updateSettings({ activeContext: id })}
        onPhrase={(text) => { replaceSentence(text.split(' ')); say(text); close(); }}
      />
      <SavedSheet
        visible={sheet === 'saved'} onClose={close}
        favourites={favourites} history={history} hasWords={hasWords} isCurrentFavourite={isCurrentFavourite}
        onToggleCurrent={handleToggleFavourite} onFavourite={(f) => { speakFavourite(f); close(); }}
        onHistory={(h) => { repeatFromHistory(h); close(); }} onRemoveFavourite={confirmRemoveFavourite}
      />
      <ShowMessage visible={sheet === 'show'} onClose={close} text={message} onSpeak={hasWords ? speakSentence : null} />
      <ModeSheet visible={sheet === 'mode'} onClose={close} />
      <MoreSheet
        visible={sheet === 'more'} onClose={close}
        modelling={modelling} onToggleModelling={() => { setModelling((m) => !m); close(); }}
        voicePreset={voicePreset} onVoicePreset={setVoicePreset}
        scanActive={scanActive} onToggleScan={() => { close(); toggleScan(); }}
        onCamera={() => { close(); navigation.navigate('Camera'); }}
        onStudio={() => { close(); navigation.navigate('Studio'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: space.xs, gap: 2 },
  modePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: touch.min },
  brandDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  modelTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, marginRight: 4 },
  stage: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  controls: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  tools: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  tool: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  wide: { flex: 1, flexDirection: 'row' },
  notice: { position: 'absolute', left: space.md, right: space.md, padding: space.md, flexDirection: 'row', alignItems: 'center', zIndex: 20, opacity: 0.96 },
  scanStrip: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderWidth: 2, zIndex: 15 },
  chipMenu: { position: 'absolute', left: space.md, right: space.md, top: '30%', padding: space.lg, borderWidth: 1, zIndex: 30, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
});
