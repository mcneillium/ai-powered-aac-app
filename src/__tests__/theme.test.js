// Tests for theme system
import {
  getPalette, palettes, brand, fitzgerald, fitzKey, experiences, getExperience, symbolsOn, TILE_HEIGHT,
} from '../theme';

describe('theme', () => {
  test('getPalette returns light palette by default', () => {
    const palette = getPalette('light');
    expect(palette.background).toBe('#F6F4EF');
    expect(palette.text).toBe('#1F2433');
  });

  test('getPalette returns dark palette', () => {
    const palette = getPalette('dark');
    expect(palette.background).toBe('#12141C');
    expect(palette.text).toBe('#ECEDF2');
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

describe('redesign contrast (Soft Studio)', () => {
  Object.entries(palettes).forEach(([name, p]) => {
    test(`${name}: suggestion text and tab labels are at least 4.5:1`, () => {
      expect(contrast(p.onPrimaryMuted, p.chipBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onPrimaryMuted, p.primaryMuted)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.tabBarActive, p.tabBarPill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.tabBarInactive, p.tabBarBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.text, p.tileBg)).toBeGreaterThanOrEqual(7);
    });

    test(`${name}: every Fitzgerald colour cap is visible on a plain tile (3:1)`, () => {
      Object.entries(fitzgerald[name]).forEach(([key, c]) => {
        expect({ key, ok: contrast(c.cap, p.tileBg) >= 3 }).toEqual({ key, ok: true });
      });
    });

    test(`${name}: word labels on Child tinted tiles are at least 7:1 (AAA)`, () => {
      Object.entries(fitzgerald[name]).forEach(([key, c]) => {
        expect({ key, ok: contrast(p.text, c.tint) >= 7 }).toEqual({ key, ok: true });
      });
    });
  });
});

describe('Fitzgerald key mapping', () => {
  test('maps the vocabulary fills and categories, with a fallback', () => {
    expect(fitzKey({ color: '#FFF9C4' })).toBe('pronoun');
    expect(fitzKey({ color: '#c8e6c9' })).toBe('verb');
    expect(fitzKey({ multiWord: true, color: '#E3F2FD' })).toBe('starter');
    expect(fitzKey({ color: '#123456', category: 'noun' })).toBe('noun');
    expect(fitzKey({ color: '#123456', category: 'whatever' })).toBe('misc');
    expect(fitzKey(null)).toBe('misc');
  });

  test('every core vocabulary button gets a known key', () => {
    const { corePages } = require('../data/coreVocabulary');
    Object.values(corePages).forEach(page => page.buttons.forEach(b => {
      expect(fitzgerald.light[fitzKey(b)]).toBeDefined();
    }));
  });
});

describe('experiences', () => {
  test('Child and Adult never change layout-defining values', () => {
    // Grid columns, tile height and word order are not part of an experience.
    Object.values(experiences).forEach(x => {
      ['numColumns', 'gridSize', 'tileHeight', 'tileMinHeight', 'order'].forEach(k => {
        expect(x[k]).toBeUndefined();
      });
    });
    expect(TILE_HEIGHT).toBeGreaterThanOrEqual(80);
  });

  test('unknown experience falls back to Adult', () => {
    expect(getExperience(undefined).id).toBe('adult');
    expect(getExperience('nope').id).toBe('adult');
  });

  test('pictures follow the experience unless the user chose', () => {
    expect(symbolsOn({ experience: 'child' })).toBe(true);
    expect(symbolsOn({ experience: 'adult' })).toBe(false);
    expect(symbolsOn({ experience: 'child', showSymbols: false })).toBe(false);
    expect(symbolsOn({ experience: 'adult', showSymbols: true })).toBe(true);
    expect(symbolsOn({ experience: 'adult', showSymbols: null })).toBe(false);
  });
});
