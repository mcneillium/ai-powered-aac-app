/* eslint-env jest */
// Component contracts and board integration; no native text measurement claimed.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScanControls from '../components/ScanControls';
import { setLanguage } from '../i18n/strings';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true, default: () => ({ width: 320, height: 700, scale: 3, fontScale: 2 }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return { usePaper: () => ({ theme: 'light', mode: 'adult', c: getScheme('light'), r: shape.adult, scale: 1.5, reduceMotion: true }) };
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
const ClassicBoard = require('../screens/AACBoardScreen').default;
const mockStop = jest.fn();
let mockBoard;
let renderer;
const colors = { stopBg: '#fff', stopFg: '#000', quietBg: '#fff', quietFg: '#000', selectBg: '#000', selectFg: '#fff' };
const flat = StyleSheet.flatten;
async function mount(node) { await act(async () => { renderer = TestRenderer.create(node); }); return renderer.root; }
beforeEach(() => {
  mockBoard = {
    settings: { showScanControls: false, showVoiceStyles: false, theme: 'light', gridSize: 4 },
    palette: {}, navigation: { navigate: jest.fn() },
    sentenceWords: [], suggestions: [], history: [], favourites: [], pageHistory: [],
    currentPage: { id: 'home', label: 'Home', buttons: [] }, currentPageId: 'home',
    isScanFocused: () => false, scanActive: true, toggleScan: mockStop,
    compact: true, textScale: 1.5, numColumns: 4,
    insets: { top: 0, bottom: 24 }, gridRef: { current: null }, sentenceScrollRef: { current: null },
  };
  mockStop.mockClear();
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; setLanguage('en'); });

test.each(['en', 'es'])('scan controls keep full accessible labels, wrapping and independent actions (%s)', async language => {
  setLanguage(language);
  const next = jest.fn(), select = jest.fn();
  const root = await mount(<ScanControls mode="step" onStop={mockStop} onNext={next} onSelect={select} colors={colors} textScale={1.5} />);
  const buttons = root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.style === 'function');
  expect(buttons).toHaveLength(3);
  expect(buttons[0].props.accessibilityLabel).toBe(language === 'en' ? 'Stop switch scanning' : 'Detener escaneo');
  buttons.forEach(button => {
    const style = flat(button.props.style({ pressed: false }));
    expect(style.flex).toBe(1);
    expect(style.minWidth).toBe(0);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    const label = button.findByType(Text);
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.adjustsFontSizeToFit).toBe(false);
    expect(flat(label.props.style).fontSize).toBe(21);
    act(() => button.props.onPress());
  });
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(1);
});

test('auto scan retains Stop and Select, without a misleading Next action', async () => {
  const root = await mount(<ScanControls mode="auto" onStop={mockStop} onSelect={() => {}} colors={colors} />);
  expect(root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.style === 'function').map(n => n.props.accessibilityLabel)).toEqual(['Stop switch scanning', 'Select']);
});

test.each([['Studio', StudioBoard], ['Classic', ClassicBoard]])('%s clears a taller scan overlay without changing grid identity or columns', async (_name, Board) => {
  const root = await mount(<Board />);
  const grid = () => root.findByType(FlatList);
  const data = grid().props.data;
  const columns = grid().props.numColumns;
  const overlay = root.findAllByType(View).find(n => n.props.onLayout && flat(n.props.style)?.position === 'absolute');
  expect(overlay).toBeDefined();
  act(() => overlay.props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
  const bottom = flat(overlay.props.style).bottom;
  expect(flat(grid().props.contentContainerStyle).paddingBottom).toBeGreaterThan(240 + bottom);
  expect(grid().props.data).toBe(data);
  expect(grid().props.numColumns).toBe(columns);
  expect(root.findByType(ScanControls).props.onStop).toBe(mockStop);
  mockBoard.scanActive = false;
  await act(async () => renderer.update(<Board />));
  expect(root.findAllByType(ScanControls)).toHaveLength(0);
  expect(grid().props.data).toBe(data);
  expect(grid().props.numColumns).toBe(columns);
});


test('bottom-positioned speech tools stay below the scan strip as their height changes', async () => {
  mockBoard.settings.controlsPosition = 'bottom';
  const root = await mount(<StudioBoard />);
  const composer = root.findAllByType(View).find(n => n.props.onLayout && !flat(n.props.style)?.position);
  const overlay = () => root.findAllByType(View).find(n => n.props.onLayout && flat(n.props.style)?.position === 'absolute');
  for (const height of [180, 300]) {
    act(() => composer.props.onLayout({ nativeEvent: { layout: { height } } }));
    expect(flat(overlay().props.style).bottom).toBe(height + 8);
  }
  act(() => overlay().props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  // Grid itself ends above the composer; clearance is for toolbar + gap only.
  expect(flat(root.findByType(FlatList).props.contentContainerStyle).paddingBottom).toBeGreaterThan(208);
});
