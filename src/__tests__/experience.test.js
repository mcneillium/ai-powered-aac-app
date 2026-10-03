// Child / Adult modes and the board layout choice.
import {
  effectiveSettings, routeSettingsUpdate, migrateExperience, PER_MODE_KEYS,
} from '../contexts/experience';

describe('migrateExperience', () => {
  test('existing installs keep the familiar board', () => {
    expect(migrateExperience({ theme: 'dark' }, true)).toEqual({ boardLayout: 'classic' });
  });
  test('new installs start with the new board', () => {
    expect(migrateExperience(null, false)).toEqual({ boardLayout: 'studio' });
  });
  test('an explicit choice is never overridden', () => {
    expect(migrateExperience({ boardLayout: 'classic' }, false)).toBeNull();
    expect(migrateExperience({ boardLayout: 'studio' }, true)).toBeNull();
  });
});

describe('modes', () => {
  const legacy = { theme: 'dark', textScale: 1.5, gridSize: 3, speechRate: 0.6 };

  test('without a chosen mode, settings are unchanged (no silent layout change)', () => {
    expect(effectiveSettings(legacy)).toBe(legacy);
  });

  test('choosing a mode carries over accessibility choices', () => {
    const next = routeSettingsUpdate(legacy, { uiMode: 'adult' });
    const eff = effectiveSettings(next);
    expect(eff.theme).toBe('dark');
    expect(eff.textScale).toBe(1.5);
    expect(eff.gridSize).toBe(4); // Adult default density
    expect(eff.speechRate).toBe(0.6); // shared
  });

  test('each mode keeps its own presentation settings', () => {
    let s = routeSettingsUpdate(legacy, { uiMode: 'child' });
    s = routeSettingsUpdate(s, { textScale: 1.25, gridSize: 3 });
    s = routeSettingsUpdate(s, { uiMode: 'adult' });
    s = routeSettingsUpdate(s, { gridSize: 5 });
    expect(effectiveSettings(s).gridSize).toBe(5);
    s = routeSettingsUpdate(s, { uiMode: 'child' });
    expect(effectiveSettings(s).gridSize).toBe(3);
    expect(effectiveSettings(s).textScale).toBe(1.25);
  });

  test('shared settings stay shared across modes', () => {
    let s = routeSettingsUpdate(legacy, { uiMode: 'child' });
    s = routeSettingsUpdate(s, { speechRate: 0.8, personalLearning: true });
    s = routeSettingsUpdate(s, { uiMode: 'adult' });
    expect(effectiveSettings(s).speechRate).toBe(0.8);
    expect(effectiveSettings(s).personalLearning).toBe(true);
  });

  test('switching back and forth never resets a profile', () => {
    let s = routeSettingsUpdate(legacy, { uiMode: 'child' });
    s = routeSettingsUpdate(s, { symbolStyle: 'text' });
    s = routeSettingsUpdate(s, { uiMode: 'adult' });
    s = routeSettingsUpdate(s, { uiMode: 'child' });
    expect(effectiveSettings(s).symbolStyle).toBe('text');
  });

  test('vocabulary-related and data keys are never per-mode', () => {
    ['speechVoice', 'speechRate', 'personalLearning', 'boardLayout', 'scanMode'].forEach((k) => {
      expect(PER_MODE_KEYS).not.toContain(k);
    });
  });
});
