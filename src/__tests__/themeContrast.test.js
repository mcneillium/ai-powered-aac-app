/**
 * WCAG 2.2 contrast, computed from the actual palette values.
 *
 * theme.test.js asserts that tokens *exist*. That could never fail on a colour
 * change, which is how the palette came to have twelve filled-button
 * combinations below 4.5:1 — the worst at 1.97:1 — across both themes, with
 * dark mode consistently worse than light because the accents were lightened
 * for dark backgrounds without re-checking the white foreground.
 *
 * This computes the ratios instead. Getting the contrast wrong now breaks the
 * build rather than shipping.
 */

import { palettes } from '../theme';

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.2 contrast ratio. Exported shape kept simple so failures read well. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const round = (n) => Math.round(n * 100) / 100;

// Every colour a filled button uses as a background, paired with the text
// colour that sits on it.
const FILLED_BUTTON_TOKENS = ['primary', 'danger', 'info', 'success', 'warning', 'accent'];

describe('contrast: text on filled buttons meets WCAG 2.2 AA (4.5:1)', () => {
  for (const themeName of ['light', 'dark', 'highContrast']) {
    for (const token of FILLED_BUTTON_TOKENS) {
      test(`${themeName}.${token} vs buttonText`, () => {
        const palette = palettes[themeName];
        const ratio = contrast(palette.buttonText, palette[token]);
        expect({ theme: themeName, token, ratio: round(ratio) }).toEqual(
          expect.objectContaining({ ratio: expect.any(Number) }),
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('contrast: body text on surfaces meets WCAG 2.2 AA (4.5:1)', () => {
  const PAIRS = [
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'cardBg'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
  ];
  for (const themeName of ['light', 'dark', 'highContrast']) {
    for (const [fg, bg] of PAIRS) {
      test(`${themeName}: ${fg} on ${bg}`, () => {
        const palette = palettes[themeName];
        expect(round(contrast(palette[fg], palette[bg]))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('contrast: UI component boundaries meet WCAG 2.2 AA (3:1)', () => {
  const PAIRS = [
    ['border', 'background'],
    ['border', 'surface'],
    ['inputBorder', 'inputBg'],
  ];
  for (const themeName of ['light', 'dark', 'highContrast']) {
    for (const [fg, bg] of PAIRS) {
      test(`${themeName}: ${fg} against ${bg}`, () => {
        const palette = palettes[themeName];
        expect(round(contrast(palette[fg], palette[bg]))).toBeGreaterThanOrEqual(3.0);
      });
    }
  }
});

describe('contrast: the switch-scan focus ring', () => {
  // Every surface a scan ring can land on. The Fitzgerald Key fills are fixed
  // constants in coreVocabulary.js, not palette tokens, so they are listed
  // here explicitly — if those change, this test is where it should surface.
  const FITZGERALD_FILLS = ['#FFE0B2', '#FFF9C4', '#FFCDD2', '#C8E6C9', '#E1BEE7', '#B3E5FC', '#E0E0E0'];

  test('black clears 3:1 on every light/dark surface a ring can sit on', () => {
    const surfaces = [
      ...FITZGERALD_FILLS,
      ...FILLED_BUTTON_TOKENS.map((t) => palettes.light[t]),
      ...FILLED_BUTTON_TOKENS.map((t) => palettes.dark[t]),
      palettes.light.chipBg,
      palettes.light.surface,
    ];
    const failures = surfaces
      .map((s) => ({ surface: s, ratio: round(contrast('#000000', s)) }))
      .filter((r) => r.ratio < 3.0);
    expect(failures).toEqual([]);
  });

  test('white clears 3:1 on the high-contrast button fill', () => {
    expect(round(contrast('#FFFFFF', palettes.highContrast.cardBg))).toBeGreaterThanOrEqual(3.0);
  });

  test('the old #FF6600 ring would still fail — the regression this pins', () => {
    // Kept deliberately: if someone reverts the ring colour, the failure above
    // is abstract. This makes the reason concrete.
    const worst = Math.min(...FITZGERALD_FILLS.map((f) => contrast('#FF6600', f)));
    expect(worst).toBeLessThan(3.0);
  });
});
