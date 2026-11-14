/* eslint-env jest */
// Owner report (2026-10-04): tile text overlapped the category stripe.
// Root cause: a word wider than the tile at 12 px used the side padding
// (paddingHorizontal 0) and then 11 px, so in Adult / High contrast the
// label's box started at the border, over the 5 px stripe. Required: text
// never over the stripe or border in any focus state, never below 12 px,
// and a word that does not fit on one line is wrapped with a visible
// hyphen ("bath-" / "room") instead of shrinking or being broken anywhere
// by the platform. Grid geometry (tile width/height) is unchanged.
//
// Level: unit (react-test-renderer + the label width estimator). Real text
// measurement on a device is still needed.
import React from 'react';
import { Image, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { linesAt, textWidthEm, fitTileLabel, hyphenateLabel } from '../design/fitLabel';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockFontScale = 1;
let mockTextScale = 1;
let mockTheme = 'light';
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return {
    usePaper: () => ({ theme: mockTheme, mode: 'adult', c: getScheme(mockTheme), r: shape.adult, scale: mockTextScale, reduceMotion: true }),
  };
});
const { Tile } = require('../design/components');

const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
// StudioBoardScreen geometry (not changed): grid padding 8 each side, tile
// margin 4 each side; height 104 x min(text size, 1.5).
const gridTileWidth = (screen, columns) => Math.floor((screen - 16) / columns) - 8;
const gridTileHeight = (textScale) => Math.round(104 * Math.min(textScale, 1.5));
const STRIPE = 5;

const CORE = ['thank you', 'I feel', 'I need help', 'Food & Drink', 'bathroom'];
const LONG = ['Overwhelmed', 'Appointments', 'Embarrassed', 'toothbrush'];
const LABELS = [...CORE, ...LONG];
const plain = (s) => String(s).replace(/-\n/g, '').replace(/\s+/g, ' ').trim();

function render(label, props) {
  let r;
  act(() => {
    r = TestRenderer.create(
      <Tile button={{ id: label, label, category: 'noun' }} accessibilityLabel={`Say ${label}`} {...props} />
    );
  });
  return r;
}

/** Geometry of the rendered tile, read from its styles. */
function inspect(r, label, tileWidth) {
  const box = flat(r.root.findAll((n) => n.props.style && flat(n.props.style).overflow === 'hidden')[0].props.style);
  const border = box.borderWidth || 0;
  const padL = box.paddingLeft ?? box.paddingHorizontal ?? box.padding ?? 0;
  const padR = box.paddingRight ?? box.paddingHorizontal ?? box.padding ?? 0;
  const text = r.root.findAllByType(Text).find((t) => typeof t.props.children === 'string' && plain(t.props.children) === label);
  const ts = flat(text.props.style);
  const contentLeft = border + padL + (ts.marginLeft ?? ts.marginHorizontal ?? 0);
  const contentRight = tileWidth - border - padR - (ts.marginRight ?? ts.marginHorizontal ?? 0);
  const stripe = r.root.findAll((n) => n.type === View && n.props.style && flat(n.props.style).position === 'absolute'
    && flat(n.props.style).left === 0 && flat(n.props.style).width === STRIPE);
  const stripeRight = stripe.length ? border + STRIPE : 0;
  const display = text.props.children;
  // Lines the platform will draw: the explicit lines, each wrapped at spaces.
  const width = contentRight - contentLeft;
  const explicit = display.split('\n');
  const wrapped = explicit.reduce((n, l) => n + linesAt(l, ts.fontSize, width), 0);
  let symbol = 0;
  const emoji = r.root.findAllByType(Text).find((t) => t.props.children === '🙂');
  if (emoji) { const s = flat(emoji.props.style); symbol = s.lineHeight + s.marginBottom; }
  const imgs = r.root.findAllByType(Image);
  if (imgs.length) { const s = flat(imgs[0].parent.props.style); symbol = s.height + s.marginBottom; }
  const padV = box.paddingVertical ?? box.padding ?? 0;
  const needed = 2 * padV + 2 * border + symbol + wrapped * ts.lineHeight;
  return {
    text, ts, display, explicit, width, wrapped, contentLeft, contentRight, stripeRight, needed, height: box.height,
    size: ts.fontSize, numberOfLines: text.props.numberOfLines,
  };
}

afterEach(() => { mockFontScale = 1; mockTextScale = 1; mockTheme = 'light'; });

const cases = [];
[320, 360, 390, 412].forEach((screen) => [3, 4, 5].forEach((cols) => [1, 1.5].forEach((ts) => [1, 2].forEach((fs) => {
  [false, true].forEach((focused) => cases.push([screen, cols, ts, fs, focused]));
}))));

describe.each(['light', 'highContrast'])('Adult tile label stays clear of the category stripe (%s)', (theme) => {
  test.each(cases)('%i dp, %i per row, text %f, font %f, focused %s', (screen, cols, ts, fs, focused) => {
    mockTheme = theme; mockTextScale = ts; mockFontScale = fs;
    const width = gridTileWidth(screen, cols);
    const height = gridTileHeight(ts);
    const problems = [];
    LABELS.forEach((label) => ['mixed', 'text'].forEach((symbolStyle) => {
      const r = render(label, { width, height, focused, emoji: '🙂', symbolStyle });
      const m = inspect(r, label, width);
      const at = `${label} (${symbolStyle})`;
      if (!(m.stripeRight > 0)) problems.push(`${at}: stripe not found`);
      if (m.contentLeft < m.stripeRight) problems.push(`${at}: text box starts at ${m.contentLeft}, stripe ends at ${m.stripeRight}`);
      if (m.contentRight > width - (focused ? 4 : 1)) problems.push(`${at}: text box ends inside the border`);
      if (m.size < 12) problems.push(`${at}: ${m.size} px is below 12`);
      // Every word / hyphenated piece fits the width (Infinity otherwise,
      // which means the platform would break it at an arbitrary letter).
      if (!Number.isFinite(m.wrapped)) problems.push(`${at}: a line is wider than ${m.width} px at ${m.size} px`);
      m.explicit.forEach((l) => {
        if (textWidthEm(l) * m.size > m.width + 0.01 && !/\s/.test(l)) problems.push(`${at}: "${l}" too wide`);
      });
      // A word is only ever broken with a visible hyphen.
      if (plain(m.display) !== label) problems.push(`${at}: shown as ${JSON.stringify(m.display)}`);
      m.explicit.slice(0, -1).forEach((l) => {
        const next = m.explicit[m.explicit.indexOf(l) + 1];
        if (!l.endsWith('-') && !(label.includes(`${l.split(' ').pop()} ${next.split(' ')[0]}`))) {
          problems.push(`${at}: "${l}" breaks a word without a hyphen`);
        }
      });
      // Nothing clipped by the tile (overflow hidden) in the matrix.
      if (m.needed > m.height) problems.push(`${at}: needs ${m.needed} px, tile is ${m.height}`);
      // Nothing ellipsised: the Text allows every line it has.
      if (Number.isFinite(m.wrapped) && m.numberOfLines < m.wrapped) problems.push(`${at}: ${m.wrapped} lines, numberOfLines ${m.numberOfLines}`);
      // The accessible name is the plain label, not the hyphenated text.
      const pressable = r.root.findAll((n) => n.props.accessibilityRole === 'button')[0];
      if (pressable.props.accessibilityLabel !== `Say ${label}`) problems.push(`${at}: accessible name changed`);
    }));
    expect(problems).toEqual([]);
  });
});

describe('hyphenated wrapping', () => {
  test('a word wider than the tile at 12 px is wrapped with a hyphen, not shrunk', () => {
    // 320 dp, 4 per row, text 1.5, font 2: label width 48, "bathroom" ~60 px at 12.
    const fit = fitTileLabel('bathroom', 45, { width: 48, height: 136, symbol: 0 });
    expect(fit.size).toBeGreaterThanOrEqual(12);
    expect(fit.text).toBe('bath-\nroom');
    expect(fit.lines).toBe(2);
    expect(fit.fits).toBe(true);
  });

  test('break points leave at least 3 letters each side and avoid splitting th / wh / br', () => {
    expect(hyphenateLabel('toothbrush', 12, 44)).toEqual(['tooth-', 'brush']);
    expect(hyphenateLabel('Overwhelmed', 12, 60)).toEqual(['Over-', 'whelmed']);
    expect(hyphenateLabel('Embarrassed', 12, 52)).toEqual(['Embar-', 'rassed']);
    expect(hyphenateLabel('Appointments', 12, 60)).toEqual(['Appoint-', 'ments']);
  });

  test('multi-word labels wrap at spaces before any word is hyphenated', () => {
    expect(hyphenateLabel('thank you', 15, 60)).toEqual(['thank', 'you']);
    expect(hyphenateLabel('I need help', 15, 200)).toEqual(['I need help']);
  });

  test('a word that fits at 12 px or more is shrunk (as before) rather than hyphenated', () => {
    // 390 dp, 4 per row, text 1.5: 66 px label width; "bathroom" fits at 13.
    const fit = fitTileLabel('bathroom', 23, { width: 66, height: 136 });
    expect(fit.text).toBe('bathroom');
    expect(linesAt('bathroom', fit.size, 66)).toBe(1);
    expect(fit.size).toBeGreaterThanOrEqual(12);
  });

  test('the hyphenated text is not exposed as a separate accessible name', () => {
    mockTextScale = 1.5; mockFontScale = 2;
    const r = render('bathroom', { width: gridTileWidth(320, 4), height: 156, symbolStyle: 'text' });
    const m = inspect(r, 'bathroom', gridTileWidth(320, 4));
    expect(m.display).toBe('bath-\nroom');
    expect(m.text.props.importantForAccessibility).toBe('no');
    expect(m.text.props.accessibilityElementsHidden).toBe(true);
    const pressable = r.root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(pressable.props.accessibilityLabel).toBe('Say bathroom');
  });

  test('without an explicit accessibility label the name falls back to the plain label', () => {
    let r;
    act(() => { r = TestRenderer.create(<Tile button={{ id: 'b', label: 'bathroom', category: 'noun' }} width={68} height={104} symbolStyle="text" />); });
    const pressable = r.root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(pressable.props.accessibilityLabel).toBe('bathroom');
  });
});

describe('labels that cannot fit in 3 lines at 12 px (reported, not hidden)', () => {
  // Same budgets as Tile: 6 px padding + 4 px focus border each side, 4 px
  // of right padding available, smallest picture 20 px + 4 px gap.
  test('only Overwhelmed / Appointments at 320 dp, 5 per row need 4 lines', () => {
    const over = new Set();
    [320, 360, 390, 412].forEach((screen) => [3, 4, 5].forEach((cols) => [1, 1.5].forEach((ts) => [1, 2].forEach((fs) => {
      const width = gridTileWidth(screen, cols) - 20;
      LABELS.forEach((label) => {
        const fit = fitTileLabel(label, Math.round(15 * ts * fs), { width, height: gridTileHeight(ts) - 20, symbol: 24, pad: 4 });
        expect(fit.size).toBeGreaterThanOrEqual(12);
        if (!fit.fits) over.add(`${screen}/${cols}: ${fit.text.replace(/\n/g, ' ')}`);
      });
    }))));
    // Label box 32 px (36 with the right padding): at 12 px these need four
    // pieces. The honest remedy is the existing words-per-row setting.
    expect([...over].sort()).toEqual(['320/5: App- oin- tme- nts', '320/5: O- ver- whe- lmed']);
  });
});
