// Tests for voice presets

// Mock expo-speech before importing
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

import { voicePresets, applyPreset } from '../services/speechService';

describe('voicePresets', () => {
  test('has at least 4 presets', () => {
    expect(Object.keys(voicePresets).length).toBeGreaterThanOrEqual(4);
  });

  test('every preset has label, rate, pitch, icon', () => {
    Object.values(voicePresets).forEach(preset => {
      expect(preset.label).toBeTruthy();
      expect(typeof preset.rate).toBe('number');
      expect(typeof preset.pitch).toBe('number');
      expect(preset.icon).toBeTruthy();
    });
  });

  test('normal preset has rate=1.0 and pitch=1.0', () => {
    expect(voicePresets.normal.rate).toBe(1.0);
    expect(voicePresets.normal.pitch).toBe(1.0);
  });

  test('calm preset has slower rate', () => {
    expect(voicePresets.calm.rate).toBeLessThan(1.0);
  });

  test('excited preset has faster rate and higher pitch', () => {
    expect(voicePresets.excited.rate).toBeGreaterThan(1.0);
    expect(voicePresets.excited.pitch).toBeGreaterThan(1.0);
  });
});

describe('applyPreset', () => {
  test('applies preset rate and pitch to base options', () => {
    const result = applyPreset('calm', { voice: 'en-us' });
    expect(result.rate).toBe(voicePresets.calm.rate);
    expect(result.pitch).toBe(voicePresets.calm.pitch);
    expect(result.voice).toBe('en-us');
  });

  test('returns base options for unknown preset', () => {
    const base = { rate: 1.0, pitch: 1.0 };
    const result = applyPreset('nonexistent', base);
    expect(result).toEqual(base);
  });
});
