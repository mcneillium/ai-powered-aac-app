/* eslint-env jest */
// Reviewer residuals (2026-10-04, unit level):
// - Tile height ignored the system font size: at fontScale 2 a two-line
//   label plus the smallest picture was taller than the tile and clipped
//   (tile has overflow: hidden).
// - "bathroom" at 320 dp, 4 per row could not fit at the 12 px minimum in
//   the padded label width, so the platform broke it inside the word.
// - N4: an onLayout reporting the grid's width must not change the label.
import React from 'react';
import { Image, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { linesAt } from '../design/fitLabel';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockFontScale = 1;
let mockTextScale = 1;
let mockMode = 'adult';
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return {
    usePaper: () => ({ theme: 'light', mode: mockMode, c: getScheme('light'), r: shape[mockMode], scale: mockTextScale, reduceMotion: true }),
  };
});
const { Tile } = require('../design/components');

const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
// StudioBoardScreen geometry: grid padding 8 each side, tile margin 4 each side.
const gridTileWidth = (screen, columns) => Math.floor((screen - 16) / columns) - 8;
const FOCUS_BORDER = 4; // widest border a tile can have (scan focus)

function render(label, props) {
  let r;
  act(() => {
    r = TestRenderer.create(
      <Tile button={{ id: label, label, category: 'noun' }} accessibilityLabel={label} {...props} />
    );
  });
  return r;
}

/** Vertical space the tile's content needs, from the rendered styles. */
function measure(r, label, tileWidth) {
  const box = flat(r.root.findAll((n) => n.props.style && flat(n.props.style).overflow === 'hidden')[0].props.style);
  const text = r.root.findAllByType(Text).find((t) => t.props.children === label);
  const ts = flat(text.props.style);
  const padH = box.paddingHorizontal + (ts.marginHorizontal || 0);
  const textWidth = tileWidth - 2 * FOCUS_BORDER - 2 * padH;
  const lines = linesAt(label, ts.fontSize, textWidth);
  let symbol = 0;
  const emoji = r.root.findAllByType(Text).find((t) => t.props.children === '🙂');
  if (emoji) { const s = flat(emoji.props.style); symbol = s.lineHeight + s.marginBottom; }
  const imgs = r.root.findAllByType(Image);
  if (imgs.length) { const s = flat(imgs[0].parent.props.style); symbol = s.height + s.marginBottom; }
  const needed = 2 * box.paddingVertical + 2 * FOCUS_BORDER + symbol + Math.min(lines, 2) * ts.lineHeight;
  return { size: ts.fontSize, lines, lineHeight: ts.lineHeight, symbol, needed, height: box.height, textWidth };
}

afterEach(() => { mockFontScale = 1; mockTextScale = 1; mockMode = 'adult'; });

describe('tile content fits the tile height at large system font sizes', () => {
  const cases = [];
  [320, 360, 390, 412].forEach((screen) => [3, 4].forEach((cols) => [1.3, 1.5, 2].forEach((fs) => ['adult', 'child'].forEach((mode) => {
    ['thank you', 'I feel', 'I need help', 'Food & Drink'].forEach((label) => cases.push([screen, cols, fs, mode, label]));
  }))));
  test.each(cases)('%i dp, %i per row, font %f, %s: "%s"', (screen, cols, fs, mode, label) => {
    mockFontScale = fs; mockMode = mode;
    const width = gridTileWidth(screen, cols);
    const r = render(label, { width, height: 104, emoji: '🙂', symbolStyle: 'mixed' });
    const m = measure(r, label, width);
    expect(m.lines).toBeLessThanOrEqual(2);
    expect(m.needed).toBeLessThanOrEqual(m.height);
    expect(m.size).toBeGreaterThanOrEqual(12);
  });

  test('realistic case from the review: 390 dp, 3 per row, font 2, "thank you"', () => {
    mockFontScale = 2;
    const r = render('thank you', { width: gridTileWidth(390, 3), height: 104, emoji: '🙂' });
    const m = measure(r, 'thank you', gridTileWidth(390, 3));
    expect(m.needed).toBeLessThanOrEqual(104);
    expect(m.symbol).toBeGreaterThanOrEqual(24); // picture kept (20 px min + 4 gap)
  });

  test('the picture is dropped rather than the word clipped when nothing else fits', () => {
    mockFontScale = 2;
    // Very short tile: two 12 px lines (30) + picture (24) + chrome (20) > 60.
    const r = render('thank you', { width: 70, height: 60, emoji: '🙂' });
    const m = measure(r, 'thank you', 70);
    expect(r.root.findAllByType(Text).some((t) => t.props.children === '🙂')).toBe(false);
    expect(m.needed).toBeLessThanOrEqual(60);
  });
});

describe('words are never broken inside', () => {
  test('"bathroom" at 320 dp, 4 per row, largest text fits on one line', () => {
    mockFontScale = 2; mockTextScale = 1.5;
    const width = gridTileWidth(320, 4); // 68
    const r = render('bathroom', { width, height: 156, symbolStyle: 'text' });
    const m = measure(r, 'bathroom', width);
    expect(m.lines).toBe(1);
    expect(m.size).toBeGreaterThanOrEqual(11);
  });

  test('labels are never ellipsised or cut by the platform', () => {
    const r = render('bathroom', { width: 68, height: 104, symbolStyle: 'text' });
    const text = r.root.findAllByType(Text).find((t) => t.props.children === 'bathroom');
    expect(text.props.ellipsizeMode).toBeUndefined();
    expect(text.props.numberOfLines).toBeGreaterThanOrEqual(2);
  });
});

describe('grid width is authoritative (N4)', () => {
  const labelSize = (r) => flat(r.root.findAllByType(Text).find((t) => t.props.children === 'bathroom').props.style).fontSize;
  const layout = (r, w) => {
    const pressable = r.root.findAll((n) => typeof n.props.onLayout === 'function')[0];
    act(() => { pressable.props.onLayout({ nativeEvent: { layout: { width: w, height: 156 } } }); });
  };
  test('onLayout reporting the same width does not change the label size', () => {
    mockTextScale = 1.5;
    const r = render('bathroom', { width: 86, height: 156, symbolStyle: 'text' });
    const first = labelSize(r);
    expect(first).toBeLessThan(23);
    layout(r, 86);
    expect(labelSize(r)).toBe(first);
  });
  test('onLayout reporting a different width does not override the grid width', () => {
    mockTextScale = 1.5;
    const r = render('bathroom', { width: 86, height: 156, symbolStyle: 'text' });
    const first = labelSize(r);
    layout(r, 200);
    expect(labelSize(r)).toBe(first);
  });
});
