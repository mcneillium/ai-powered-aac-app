/**
 * applyPreset must never discard the user's own speech settings.
 *
 * These fail against the pre-2026-08-08 implementation, which returned
 * `{...baseOptions, rate: preset.rate, pitch: preset.pitch}` — overwriting
 * whatever the user had chosen. Because `voicePresets.normal` is {1.0, 1.0} and
 * is the default preset, a user who set 0.5x in Settings was spoken at 1.0x on
 * every board utterance.
 */

import { applyPreset, voicePresets } from '../services/speechService';

describe('applyPreset', () => {
  test("preserves the user's rate when the preset is neutral", () => {
    const result = applyPreset('normal', { rate: 0.5, pitch: 0.8 });
    expect(result.rate).toBeCloseTo(0.5, 5);
    expect(result.pitch).toBeCloseTo(0.8, 5);
  });

  test('scales the user setting rather than replacing it', () => {
    // calm is rate 0.8; a user already at 0.5 should end up slower, not faster.
    const result = applyPreset('calm', { rate: 0.5, pitch: 1.0 });
    expect(result.rate).toBeCloseTo(0.4, 5);
    expect(result.rate).toBeLessThan(0.5);
  });

  test('excited speeds a slow user up without jumping to the preset value', () => {
    const result = applyPreset('excited', { rate: 0.5, pitch: 1.0 });
    expect(result.rate).toBeCloseTo(0.65, 5);
    expect(result.rate).not.toBeCloseTo(voicePresets.excited.rate, 5);
  });

  test('defaults to 1.0 when the caller supplies nothing', () => {
    const result = applyPreset('calm', {});
    expect(result.rate).toBeCloseTo(voicePresets.calm.rate, 5);
    expect(result.pitch).toBeCloseTo(voicePresets.calm.pitch, 5);
  });

  test('clamps into the range expo-speech accepts', () => {
    const fast = applyPreset('excited', { rate: 2.0, pitch: 2.0 });
    expect(fast.rate).toBeLessThanOrEqual(2.0);
    expect(fast.pitch).toBeLessThanOrEqual(2.0);

    const slow = applyPreset('gentle', { rate: 0.1, pitch: 0.5 });
    expect(slow.rate).toBeGreaterThanOrEqual(0.1);
    expect(slow.pitch).toBeGreaterThanOrEqual(0.5);
  });

  test('passes through untouched for an unknown preset id', () => {
    const base = { rate: 0.7, pitch: 1.3, voice: 'en-GB-x' };
    expect(applyPreset('no-such-preset', base)).toBe(base);
  });

  test('carries non-speech options through unchanged', () => {
    const result = applyPreset('serious', { rate: 1.0, voice: 'en-GB-x', language: 'en-GB' });
    expect(result.voice).toBe('en-GB-x');
    expect(result.language).toBe('en-GB');
  });
});
