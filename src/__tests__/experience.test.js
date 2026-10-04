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
    expect(eff.gridSize).toBe(3); // shared: choosing a mode never changes the grid
    expect(eff.speechRate).toBe(0.6); // shared
  });

  test('each mode keeps its own colours and picture style', () => {
    let s = routeSettingsUpdate(legacy, { uiMode: 'child' });
    s = routeSettingsUpdate(s, { theme: 'light', symbolStyle: 'symbols' });
    s = routeSettingsUpdate(s, { uiMode: 'adult' });
    s = routeSettingsUpdate(s, { theme: 'highContrast', symbolStyle: 'text' });
    expect(effectiveSettings(s).theme).toBe('highContrast');
    s = routeSettingsUpdate(s, { uiMode: 'child' });
    expect(effectiveSettings(s).theme).toBe('light');
    expect(effectiveSettings(s).symbolStyle).toBe('symbols');
  });

  test('words per row and text size are shared, so switching mode never moves a word', () => {
    let s = routeSettingsUpdate(legacy, { uiMode: 'child' });
    s = routeSettingsUpdate(s, { textScale: 1.25, gridSize: 4 });
    s = routeSettingsUpdate(s, { uiMode: 'adult' });
    expect(effectiveSettings(s).gridSize).toBe(4);
    expect(effectiveSettings(s).textScale).toBe(1.25);
    s = routeSettingsUpdate(s, { gridSize: 5 });
    s = routeSettingsUpdate(s, { uiMode: 'child' });
    expect(effectiveSettings(s).gridSize).toBe(5);
    ['gridSize', 'textScale'].forEach((k) => expect(PER_MODE_KEYS).not.toContain(k));
  });

  test('grid or text size left in a profile by an earlier build is ignored', () => {
    const s = { gridSize: 3, textScale: 1, uiMode: 'adult', modeProfiles: { adult: { gridSize: 4, textScale: 1.5, theme: 'dark' } } };
    const eff = effectiveSettings(s);
    expect(eff.gridSize).toBe(3);
    expect(eff.textScale).toBe(1);
    expect(eff.theme).toBe('dark');
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

describe('Classic board is never changed by a mode', () => {
  test('profiles are ignored while the Classic board is in use', () => {
    const s = { boardLayout: 'classic', gridSize: 3, uiMode: 'adult', modeProfiles: { adult: { gridSize: 5, showVoiceStyles: false } } };
    expect(effectiveSettings(s)).toBe(s);
  });
  test('changes made on the Classic board go to its own settings', () => {
    const s = { boardLayout: 'classic', textScale: 1, uiMode: 'adult', modeProfiles: { adult: { textScale: 1 } } };
    const next = routeSettingsUpdate(s, { textScale: 1.5 });
    expect(next.textScale).toBe(1.5);
    expect(next.modeProfiles.adult.textScale).toBe(1);
  });
});
