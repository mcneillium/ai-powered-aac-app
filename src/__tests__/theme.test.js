// Tests for theme system
import { getPalette, palettes, brand } from '../theme';

describe('theme', () => {
  test('getPalette returns light palette by default', () => {
    const palette = getPalette('light');
    expect(palette.background).toBe('#FFFFFF');
    expect(palette.text).toBe('#3A3A4A');
  });

  test('getPalette returns dark palette', () => {
    const palette = getPalette('dark');
    expect(palette.background).toBe('#1A1A2E');
    expect(palette.text).toBe('#E8E8EC');
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
