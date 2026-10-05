/* eslint-env jest */
// Large-text defects seen on the Android 15 emulator at font scale 2.0:
// 1. the empty-message hint was cut off on the left (a one-line hint in a
//    horizontal scroll view, scrolled to its end);
// 2. the Phrases tab label ran into the gesture area (fixed-height tab bar).
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { studioTabBarMetrics, BASE_BAR_HEIGHT, LABEL_MAX_SCALE } from '../design/tabBarMetrics';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true, default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 2 }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return { usePaper: () => ({ theme: 'light', mode: 'adult', c: getScheme('light'), r: shape.adult, scale: 1, reduceMotion: true }) };
});
jest.mock('../screens/useBoardController', () => ({ useBoardController: () => mockBoard }));
jest.mock('../services/speechService', () => ({ subscribeSpeechStatus: () => () => {}, stop: jest.fn() }));
jest.mock('../services/symbolStore', () => ({ loadSymbolState: async () => {}, subscribeSymbols: () => () => {}, symbolSourceFor: () => null }));
jest.mock('../services/switchScanService', () => ({ getScanState: () => ({ scanMode: 'step' }), advanceScan: jest.fn(), selectCurrent: jest.fn() }));
jest.mock('../hooks/useOverlayScan', () => ({ useOverlayScan: () => null }));
jest.mock('../components/WordFinder', () => () => null);
jest.mock('../components/DisplayMode', () => () => null);
jest.mock('../components/VoicePresetPicker', () => () => null);
jest.mock('../components/MoreActionsMenu', () => () => null);
jest.mock('../components/QuickRepairOverlay', () => ({ openQuickPhrases: jest.fn() }));
jest.mock('../components/studio/VisualMessage', () => ({ VisualMessage: () => null, VisualListRow: () => null, VisualSuggestionChip: () => null }));
jest.mock('../components/studio/ExplainSheet', () => () => null);
jest.mock('../components/studio/PhrasesSheet', () => () => null);
jest.mock('../components/studio/SavedSheet', () => () => null);
jest.mock('../components/studio/ShowMessage', () => () => null);
jest.mock('../components/studio/TypeSheet', () => () => null);
jest.mock('../components/studio/ModeSheet', () => () => null);
jest.mock('../components/studio/MoreSheet', () => () => null);
const StudioBoard = require('../screens/StudioBoardScreen').default;

let mockBoard;
let renderer;
const scrollTo = jest.fn();
const scrollToEnd = jest.fn();
const scrollRef = { current: null };
// React attaches the rendered ScrollView to the ref; put the spies back
// before triggering a size change.
const withSpies = () => { scrollRef.current = { scrollTo, scrollToEnd }; };

function board(words) {
  return {
    settings: { showScanControls: false, showVoiceStyles: false, theme: 'light', gridSize: 4 },
    palette: {}, navigation: { navigate: jest.fn() },
    sentenceWords: words, suggestions: [], history: [], favourites: [], pageHistory: [],
    currentPage: { id: 'home', label: 'Home', buttons: [] }, currentPageId: 'home',
    isScanFocused: () => false, scanActive: false, toggleScan: jest.fn(),
    compact: false, textScale: 1, numColumns: 4,
    insets: { top: 0, bottom: 24 }, gridRef: { current: null }, sentenceScrollRef: scrollRef,
  };
}

async function messageArea(words) {
  mockBoard = board(words);
  await act(async () => { renderer = TestRenderer.create(<StudioBoard />); });
  return renderer.root.findAll((n) => n.type === ScrollView && /^Message/.test(n.props.accessibilityLabel || ''))[0];
}

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  scrollTo.mockClear();
  scrollToEnd.mockClear();
});

describe('empty-message hint at large text', () => {
  test('the hint wraps in a vertical area and is shown from its start', async () => {
    const area = await messageArea([]);
    expect(area.props.accessibilityLabel).toMatch(/^Message is empty/);
    expect(area.props.horizontal).toBe(false);
    withSpies();
    act(() => area.props.onContentSizeChange(900, 120));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: false });
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  test('two full lines of the hint fit at a large system font (box grows, text capped at 1.6x)', async () => {
    const { MESSAGE_MAX_FONT_SCALE } = require('../screens/StudioBoardScreen');
    const { type } = jest.requireActual('../design/tokens');
    const area = await messageArea([]);
    const hint = area.findAll((n) => n.type === Text && /^Tap words to build a message$/.test(n.props.children))[0];
    expect(hint.props.maxFontSizeMultiplier).toBe(MESSAGE_MAX_FONT_SCALE);
    // fontScale is mocked at 2.0, so the box is sized for 1.6x text.
    const line = Math.round(type.message.lineHeight * 1);
    const height = StyleSheet.flatten(area.props.style).height;
    expect(height).toBe(Math.ceil(line * MESSAGE_MAX_FONT_SCALE) * 2 + 8);
    expect(height).toBeGreaterThan(line * 2 + 8);
  });

  test('words still scroll sideways and keep the newest word in view', async () => {
    const area = await messageArea(['I', 'want', 'more']);
    expect(area.props.accessibilityLabel).toBe('Message: I want more');
    expect(area.props.horizontal).toBe(true);
    withSpies();
    act(() => area.props.onContentSizeChange(900, 120));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });
});

describe('tab bar at large text', () => {
  test('is exactly the default height at normal text sizes', () => {
    expect(studioTabBarMetrics({ fontScale: 1, bottomInset: 0 }).height).toBe(BASE_BAR_HEIGHT);
    expect(studioTabBarMetrics({ fontScale: 0.85, bottomInset: 0 }).height).toBe(BASE_BAR_HEIGHT);
  });

  test('grows with the label so it never reaches the gesture area', () => {
    const normal = studioTabBarMetrics({ fontScale: 1, bottomInset: 48 });
    const big = studioTabBarMetrics({ fontScale: 2, bottomInset: 48 });
    expect(big.height).toBeGreaterThan(normal.height);
    expect(big.paddingBottom).toBe(48);
    // Room above the inset for a 24 dp icon plus the label's line at its largest.
    const labelLine = Math.ceil(12 * 1.25 * LABEL_MAX_SCALE);
    expect(big.height - big.paddingBottom).toBeGreaterThanOrEqual(24 + labelLine + 8);
  });

  test('labels stay readable: up to 1.6x, never shrunk below about 16 px', () => {
    const m = studioTabBarMetrics({ fontScale: 2 });
    expect(m.labelMaxMultiplier).toBe(1.6);
    const { LABEL_MIN_FIT } = require('../design/tabBarMetrics');
    expect(12 * 1.6 * LABEL_MIN_FIT).toBeGreaterThanOrEqual(16);
  });
});
