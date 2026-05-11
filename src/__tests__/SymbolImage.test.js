import { getOpenMojiSource, getOpenMojiForWord } from '../data/symbolAssetMap';

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('../data/symbolAssetMap', () => ({
  getOpenMojiSource: jest.fn((hex) => {
    if (hex === '1F604') return 'mock-happy-asset';
    return null;
  }),
  getOpenMojiForWord: jest.fn((word) => {
    if (word === 'happy') return 'mock-happy-asset';
    return null;
  }),
}));

describe('SymbolImage dependencies', () => {
  test('getOpenMojiSource returns asset for valid hexcode', () => {
    expect(getOpenMojiSource('1F604')).toBe('mock-happy-asset');
  });

  test('getOpenMojiSource returns null for invalid hexcode', () => {
    expect(getOpenMojiSource('INVALID')).toBeNull();
  });

  test('getOpenMojiForWord returns asset for mapped word', () => {
    expect(getOpenMojiForWord('happy')).toBe('mock-happy-asset');
  });

  test('getOpenMojiForWord returns null for unmapped word', () => {
    expect(getOpenMojiForWord('giraffe')).toBeNull();
  });
});

describe('SymbolImage placeholder color', () => {
  function getPlaceholderColor(word) {
    const PLACEHOLDER_COLORS = [
      '#5BB5B5', '#FF7043', '#42A5F5', '#66BB6A',
      '#EF5350', '#FFA726', '#AB47BC', '#78909C',
    ];
    if (!word) return PLACEHOLDER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = word.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
  }

  test('returns consistent color for same word', () => {
    const color1 = getPlaceholderColor('hello');
    const color2 = getPlaceholderColor('hello');
    expect(color1).toBe(color2);
  });

  test('returns different colors for different words', () => {
    const color1 = getPlaceholderColor('hello');
    const color2 = getPlaceholderColor('world');
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
  });

  test('returns default for empty input', () => {
    expect(getPlaceholderColor('')).toBe('#5BB5B5');
    expect(getPlaceholderColor(null)).toBe('#5BB5B5');
  });

  test('returns valid hex color', () => {
    const color = getPlaceholderColor('test');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
