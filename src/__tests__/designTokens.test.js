// Voice 2 colour tokens: every text/background pair used for content must
// reach WCAG AA (4.5:1), in every theme and on every category fill.
import { colorSchemes, categoryColors } from '../design/tokens';
import { studioPalettes, getPalette, palettes } from '../theme';

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

describe.each(Object.keys(colorSchemes))('%s scheme', (name) => {
  const c = colorSchemes[name];
  test.each([
    ['ink', 'paper'], ['ink', 'card'], ['ink', 'sunk'],
    ['inkSoft', 'paper'], ['inkSoft', 'card'], ['inkSoft', 'sunk'],
    ['onSignal', 'signal'], ['ink', 'signalSoft'], ['signal', 'card'],
    ['danger', 'dangerSoft'], ['danger', 'card'],
  ])('%s on %s is AA', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test('ink is readable on every Child tile fill', () => {
    Object.values(categoryColors[name]).forEach(({ fill }) => {
      expect(contrast(c.ink, fill)).toBeGreaterThanOrEqual(4.5);
    });
  });

  test('focus ring is distinguishable from the background (3:1, non-text)', () => {
    expect(contrast(c.focus, c.paper)).toBeGreaterThanOrEqual(3);
  });
});

// Secondary screens use legacy palette keys filled from these tokens when
// the new board is in use; their filled buttons must stay readable.

describe.each(Object.keys(studioPalettes))('studio palette %s', (name) => {
  const p = studioPalettes[name];
  test.each(['primary', 'danger', 'info', 'success', 'warning', 'accent'])('buttonText on %s is AA', (key) => {
    expect(contrast(p.buttonText, p[key])).toBeGreaterThanOrEqual(4.5);
  });
  test('text on background, card and surface is AA', () => {
    ['background', 'cardBg', 'surface', 'inputBg'].forEach((bg) => expect(contrast(p.text, p[bg])).toBeGreaterThanOrEqual(4.5));
  });
});

test('Classic board keeps its own palette', () => {
  expect(getPalette('dark', 'classic')).toBe(palettes.dark);
  expect(getPalette('dark')).toBe(palettes.dark);
  expect(getPalette('dark', 'studio')).toBe(studioPalettes.dark);
});
