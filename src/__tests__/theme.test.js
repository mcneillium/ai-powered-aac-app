// Tests for theme system
import { getPalette, palettes, brand } from '../theme';

describe('theme', () => {
  test('getPalette returns light palette by default', () => {
    const palette = getPalette('light');
    expect(palette.background).toBe('#FAFAFA');
    expect(palette.text).toBe('#2E2E3A');
  });

  test('getPalette returns dark palette', () => {
    const palette = getPalette('dark');
    expect(palette.background).toBe('#141420');
    expect(palette.text).toBe('#EAEAEF');
  });

  test('getPalette returns highContrast palette', () => {
    const palette = getPalette('highContrast');
    expect(palette.text).toBe('#FFD600');
  });

  test('getPalette falls back to light for unknown theme', () => {
    const palette = getPalette('unknown');
    expect(palette).toEqual(palettes.light);
  });

  test('all palettes have required color tokens', () => {
    const requiredKeys = [
      'background', 'surface', 'text', 'textSecondary', 'border',
      'tabBarBg', 'tabBarActive', 'tabBarInactive', 'cardBg',
      'primary', 'danger', 'info', 'success', 'warning',
      'inputBg', 'inputBorder', 'chipBg', 'overlay',
    ];
    Object.entries(palettes).forEach(([name, palette]) => {
      requiredKeys.forEach(key => {
        expect(palette[key]).toBeDefined();
      });
    });
  });

  test('brand constants are defined', () => {
    expect(brand.name).toBe('Voice');
    expect(brand.tagline).toBeTruthy();
    expect(brand.primaryColor).toBeTruthy();
  });
});

// WCAG contrast — filled action colours carry icons/text in buttonText.
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme contrast (WCAG AA)', () => {
  const filled = ['primary', 'danger', 'info', 'success', 'warning', 'accent'];
  Object.entries(palettes).forEach(([name, p]) => {
    test(`${name}: buttonText on filled colours is at least 4.5:1`, () => {
      filled.forEach(key => {
        expect({ key, ratio: contrast(p.buttonText, p[key]) >= 4.5 }).toEqual({ key, ratio: true });
      });
    });

    test(`${name}: body and secondary text are at least 4.5:1 on surfaces`, () => {
      ['background', 'surface', 'cardBg', 'chipBg'].forEach(bg => {
        expect(contrast(p.text, p[bg])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.textSecondary, p[bg])).toBeGreaterThanOrEqual(4.5);
      });
    });

    test(`${name}: scan focus ring is visible against the background (3:1)`, () => {
      expect(p.focusRing).toBeDefined();
      expect(contrast(p.focusRing, p.background)).toBeGreaterThanOrEqual(3);
    });
  });
});
