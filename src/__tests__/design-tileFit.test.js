/* eslint-env jest */
// Voice 2 render audit (browser, 2026-10-04) regressions:
// - Tile labels broke inside words ("bathr/oom", "schoo/l") or lost words
//   to an ellipsis on narrow tiles / large text.
// - A picture that failed to load (offline, missing file) left a blank gap.
// - Black line-art pictures were near-invisible on dark / high-contrast tiles.
// - One-letter suggestion chips were 38 px wide (< 48 dp).
// - Suggestion outlines and input borders were under 3:1.
import React from 'react';
import { Image, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { fitLabelSize, linesAt, textWidthEm } from '../design/fitLabel';
import { colorSchemes } from '../design/tokens';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockTheme = 'light';
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return {
    usePaper: () => ({ theme: mockTheme, mode: 'adult', c: getScheme(mockTheme), r: shape.adult, scale: 1.5, reduceMotion: true }),
  };
});
const { Tile, SuggestionChip } = require('../design/components');

const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));

describe('fitLabelSize', () => {
  test('keeps the user size when the label fits', () => {
    expect(fitLabelSize('home', 23, 74)).toBe(23);
  });
  test('shrinks so no word is broken (390x844, 4 per row, text 1.5)', () => {
    // Measured: 86 px tile, 66 px for text; "bathroom" broke at 23 px.
    const s = fitLabelSize('bathroom', 23, 66);
    expect(s).toBeLessThan(23);
    expect(textWidthEm('bathroom') * s).toBeLessThanOrEqual(66);
    expect(linesAt('bathroom', s, 66)).toBe(1);
  });
  test('fits multi-word labels in two lines', () => {
    const s = fitLabelSize('thank you', 26, 48);
    expect(linesAt('thank you', s, 48)).toBeLessThanOrEqual(2);
  });
  test('never goes below the minimum and leaves unknown widths alone', () => {
    expect(fitLabelSize('different', 15, 20)).toBe(12);
    expect(fitLabelSize('different', 15, 0)).toBe(15);
  });
  test('estimate is not below browser-measured widths of core words', () => {
    // em widths measured in Chromium (system font, weight 600).
    const measured = { want: 2.276, bathroom: 4.608, Feelings: 4.056, grandma: 4.221, toothbrush: 5.28 };
    Object.entries(measured).forEach(([w, em]) => expect(textWidthEm(w)).toBeGreaterThanOrEqual(em * 0.98));
  });
});

function renderTile(props) {
  let r;
  act(() => {
    r = TestRenderer.create(
      <Tile button={{ id: 'bathroom', label: 'bathroom', category: 'noun' }} height={156} accessibilityLabel="Say bathroom" {...props} />
    );
  });
  return r;
}

describe('Tile', () => {
  afterEach(() => { mockTheme = 'light'; mockFontScale = 1; });

  const labelOf = (r) => r.root.findAllByType(Text).find((t) => t.props.children === 'bathroom');

  test('label is fitted on the first render when the grid gives the width', () => {
    const r = renderTile({ symbolStyle: 'text', width: 86 });
    const s = flat(labelOf(r).props.style).fontSize;
    expect(s).toBeLessThan(23);
    expect(linesAt('bathroom', s, 66)).toBe(1);
  });

  test('system font size is included when fitting (and not applied twice)', () => {
    mockFontScale = 1.3;
    const r = renderTile({ symbolStyle: 'text', width: 200 });
    const t = labelOf(r);
    // 15 x 1.5 x 1.3 = 29: fits in 180 px, so used as is.
    expect(flat(t.props.style).fontSize).toBe(29);
    expect(t.props.maxFontSizeMultiplier).toBe(1);
    act(() => { r.update(<Tile button={{ id: 'bathroom', label: 'bathroom', category: 'noun' }} height={156} symbolStyle="text" width={86} />); });
    const s = flat(labelOf(r).props.style).fontSize;
    // Rendered size (no platform multiplier) still fits on one line.
    expect(linesAt('bathroom', s, 66)).toBe(1);
  });

  test('label shrinks to the measured tile width', () => {
    const r = renderTile({ symbolStyle: 'text' });
    const label = () => flat(r.root.findAllByType(Text).find((t) => t.props.children === 'bathroom').props.style);
    expect(label().fontSize).toBe(23); // 15 x 1.5 before layout
    const pressable = r.root.findAll((n) => typeof n.props.onLayout === 'function')[0];
    act(() => { pressable.props.onLayout({ nativeEvent: { layout: { width: 86, height: 156 } } }); });
    expect(label().fontSize).toBeLessThan(23);
    expect(label().fontSize).toBeGreaterThanOrEqual(12);
  });

  test('a picture that fails to load falls back to the built-in picture', () => {
    const r = renderTile({ symbolSource: { uri: 'file:///missing.png' }, emoji: '🚽' });
    const img = r.root.findByType(Image);
    act(() => { img.props.onError({}); });
    expect(r.root.findAllByType(Image)).toHaveLength(0);
    expect(r.root.findAllByType(Text).some((t) => t.props.children === '🚽')).toBe(true);
  });

  test('a picture that fails with no built-in picture leaves the label alone', () => {
    const r = renderTile({ symbolSource: { uri: 'file:///missing.png' }, emoji: null });
    act(() => { r.root.findByType(Image).props.onError({}); });
    expect(r.root.findAllByType(Image)).toHaveLength(0);
    expect(r.root.findAllByType(Text).map((t) => t.props.children)).toEqual(['bathroom']);
  });

  test('a new picture is tried again after a failure', () => {
    const r = renderTile({ symbolSource: { uri: 'file:///missing.png' } });
    act(() => { r.root.findByType(Image).props.onError({}); });
    act(() => {
      r.update(<Tile button={{ id: 'bathroom', label: 'bathroom', category: 'noun' }} height={156} symbolSource={{ uri: 'file:///new.png' }} />);
    });
    expect(r.root.findAllByType(Image)).toHaveLength(1);
  });

  test.each(['dark', 'highContrast'])('pictures sit on a light plate in %s', (theme) => {
    mockTheme = theme;
    const r = renderTile({ symbolSource: { uri: 'file:///toilet.png' } });
    const plate = r.root.findByType(Image).parent;
    expect(flat(plate.props.style).backgroundColor).toBe(colorSchemes[theme].symbolPlate);
  });
});

test('suggestion chips are at least 48 wide and dashed', () => {
  let r;
  act(() => { r = TestRenderer.create(<SuggestionChip word="I" onPress={() => {}} />); });
  const chip = r.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.style === 'function')[0];
  const style = flat(chip.props.style({ pressed: false }));
  expect(style.minWidth).toBeGreaterThanOrEqual(48);
  expect(style.minHeight).toBeGreaterThanOrEqual(48);
  expect(style.borderStyle).toBe('dashed');
});

// WCAG 1.4.11: outlines that identify suggestions, inputs and the switch
// "off" track need 3:1 against what they sit on.
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
describe.each(Object.keys(colorSchemes))('%s scheme non-text contrast', (name) => {
  const c = colorSchemes[name];
  test.each(['paper', 'card', 'sunk'])('lineStrong on %s is at least 3:1', (bg) => {
    expect(contrast(c.lineStrong, c[bg])).toBeGreaterThanOrEqual(3);
  });
});
