/* eslint-env jest */
// Review follow-ups for the stripe/hyphenation change:
// - Android (Fabric) ignores minimumFontScale, so platform shrink-to-fit
//   there could go far below 12 px; it is now iOS only.
// - A hyphenated split was not drawn when a piece (e.g. "bath-") also
//   appeared in the label itself.
import React from 'react';
import { Platform, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { fitTileLabel } from '../design/fitLabel';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return { usePaper: () => ({ theme: 'light', mode: 'adult', c: getScheme('light'), r: shape.adult, scale: 1.5, reduceMotion: true }) };
});
const { Tile } = require('../design/components');

function labelText(os) {
  const prev = Platform.OS;
  Platform.OS = os;
  let r;
  try {
    act(() => {
      r = TestRenderer.create(<Tile button={{ id: 'b', label: 'bathroom', category: 'noun' }} height={156} width={68} symbolStyle="text" accessibilityLabel="Say bathroom" />);
    });
    const t = r.root.findAllByType(Text).find((n) => typeof n.props.children === 'string');
    return { props: { ...t.props } };
  } finally {
    if (r) act(() => r.unmount());
    Platform.OS = prev;
  }
}

test('Android never uses platform shrink-to-fit (it ignores the 12 px floor)', () => {
  expect(labelText('android').props.adjustsFontSizeToFit).toBe(false);
});

test('iOS keeps shrink-to-fit with a 12 px floor', () => {
  const t = labelText('ios');
  expect(t.props.adjustsFontSizeToFit).toBe(true);
  const size = [].concat(t.props.style).flat(Infinity).filter(Boolean).reduce((a, s) => ({ ...a, ...s }), {}).fontSize;
  expect(size * t.props.minimumFontScale).toBeGreaterThanOrEqual(12 - 1e-9);
});

test('a hyphenated split is drawn even when a piece also appears in the label', () => {
  const fit = fitTileLabel('bath- bathroom', 17, { width: 48, height: 136, symbol: 0, pad: 4 });
  expect(fit.hyphenated).toBe(true);
  expect(fit.text.split('\n')).toHaveLength(fit.lines);
});
