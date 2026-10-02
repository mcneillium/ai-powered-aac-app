// Tests for voice presets

// Mock expo-speech before importing
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

import { voicePresets, applyPreset, buildSpeechOptions } from '../services/speechService';

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

  test('normal preset keeps the user\'s own speech rate and pitch', () => {
    // Regression: presets used to overwrite Settings, so a user who chose a
    // slow voice was spoken for at 1.0x on the board.
    const result = applyPreset('normal', { rate: 0.5, pitch: 1.25 });
    expect(result.rate).toBe(0.5);
    expect(result.pitch).toBe(1.25);
  });

  test('presets scale the user\'s settings and stay in range', () => {
    expect(applyPreset('calm', { rate: 0.5 }).rate).toBeCloseTo(0.4);
    expect(applyPreset('excited', { rate: 1.75 }).rate).toBe(2.0);
    expect(applyPreset('serious', { pitch: 0.5 }).pitch).toBe(0.5);
  });

  test('buildSpeechOptions maps settings to speak options', () => {
    const opts = buildSpeechOptions({ speechRate: 0.75, speechPitch: 1.0, speechVoice: 'v1' });
    expect(opts).toEqual({ rate: 0.75, pitch: 1.0, voice: 'v1' });
    expect(buildSpeechOptions({})).toEqual({ rate: 1.0, pitch: 1.0, voice: null });
  });

  test('returns base options for unknown preset', () => {
    const base = { rate: 1.0, pitch: 1.0 };
    const result = applyPreset('nonexistent', base);
    expect(result).toEqual(base);
  });
});
