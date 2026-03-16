import { getPalette, PALETTES, COLORS } from '../styles/theme';

describe('getPalette', () => {
  it('returns the light palette by default', () => {
    const palette = getPalette('light');
    expect(palette.background).toBe('#fff');
    expect(palette.text).toBe('#000');
  });

  it('returns the dark palette', () => {
    const palette = getPalette('dark');
    expect(palette.background).toBe('#000');
    expect(palette.text).toBe('#fff');
  });

  it('returns the highContrast palette', () => {
    const palette = getPalette('highContrast');
    expect(palette.text).toBe('#FFD600');
  });

  it('falls back to light for unknown theme names', () => {
    const palette = getPalette('nonexistent');
    expect(palette).toEqual(PALETTES.light);
  });

  it('falls back to light for undefined', () => {
    const palette = getPalette(undefined);
    expect(palette).toEqual(PALETTES.light);
  });
});

describe('COLORS', () => {
  it('has primary, danger, and info defined', () => {
    expect(COLORS.primary).toBe('#4CAF50');
    expect(COLORS.danger).toBe('#f44336');
    expect(COLORS.info).toBe('#2196F3');
  });
});
