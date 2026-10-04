/* eslint-env jest */
// Android's shrink-to-fit (new architecture) ignores minimumFontScale and
// can shrink text far below a readable size. Classic board tile labels and
// ActionButton labels used it on Android. Content is artificial.
import React from 'react';
import { Platform, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { linesAt } from '../design/fitLabel';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 320, height: 700, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return { usePaper: () => ({ theme: 'light', mode: 'adult', c: getScheme('light'), r: shape.adult, scale: 1.5, reduceMotion: true }) };
});
const { default: ClassicTileLabel, classicLabelWidth } = require('../components/ClassicTileLabel');
const { ActionButton } = require('../design/components');

const flat = (s) => Object.assign({}, ...[].concat(s).flat(Infinity).filter(Boolean));

function renderOn(os, el) {
  const prev = Platform.OS;
  Platform.OS = os;
  let r;
  try {
    act(() => { r = TestRenderer.create(el); });
    const t = r.root.findAllByType(Text).filter((n) => typeof n.props.children === 'string');
    return t.map((n) => ({ props: { ...n.props }, style: flat(n.props.style) }));
  } finally {
    if (r) act(() => r.unmount());
    Platform.OS = prev;
  }
}

afterEach(() => { mockFontScale = 1; });

// Classic grid at 320 dp, 4 per row, as AACBoardScreen computes it.
const WIDTH = classicLabelWidth(320, 4);

test('label width never exceeds the real focused tile content width', () => {
  [[320, 3], [320, 4], [320, 5], [412, 4], [800, 6]].forEach(([w, n]) => {
    const content = Math.floor((w - 8) / n) - 6 - 16 - 8; // margin, padding, 4 px scan ring
    expect(classicLabelWidth(w, n)).toBeLessThanOrEqual(content);
    expect(classicLabelWidth(w, n)).toBeGreaterThan(content - 6);
  });
});

describe('Classic board tile label', () => {
  test.each(['bathroom', 'toothbrush', 'Overwhelmed', 'thank you', 'I need help'])('%s: no Android shrink, >= 12 px, lines fit', (label) => {
    mockFontScale = 2;
    const [t] = renderOn('android', <ClassicTileLabel label={label} size={13 * 1.5} width={WIDTH} style={{}} />);
    expect(t.props.adjustsFontSizeToFit).toBe(false);
    expect(t.style.fontSize).toBeGreaterThanOrEqual(12);
    expect(t.props.maxFontSizeMultiplier).toBe(1);
    const lines = t.props.children.split('\n');
    expect(t.props.numberOfLines).toBeGreaterThanOrEqual(lines.length);
    lines.forEach((l) => expect(linesAt(l, t.style.fontSize, WIDTH)).toBeLessThanOrEqual(t.props.numberOfLines));
  });

  test('a word too wide for the tile wraps with a hyphen instead of shrinking', () => {
    const [t] = renderOn('android', <ClassicTileLabel label="Overwhelmed" size={15} width={WIDTH} style={{}} />);
    expect(t.props.children).toMatch(/-\n/);
    expect(t.style.fontSize).toBeGreaterThanOrEqual(12);
  });

  test('iOS keeps shrink-to-fit with the 12 px floor', () => {
    const [t] = renderOn('ios', <ClassicTileLabel label="bathroom" size={15} width={WIDTH} style={{}} />);
    expect(t.props.adjustsFontSizeToFit).toBe(true);
    expect(t.style.fontSize * t.props.minimumFontScale).toBeGreaterThanOrEqual(12 - 1e-9);
  });
});

test('ActionButton labels do not use Android shrink-to-fit', () => {
  const [t] = renderOn('android', <ActionButton label="Stop scanning" onPress={() => {}} />);
  expect(t.props.adjustsFontSizeToFit).toBe(false);
  const [i] = renderOn('ios', <ActionButton label="Stop scanning" onPress={() => {}} />);
  expect(i.props.adjustsFontSizeToFit).toBe(true);
});
