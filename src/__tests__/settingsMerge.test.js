// Cloud settings must never replace saved local settings with empty values.
jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), set: jest.fn() }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), signInAnonymously: jest.fn() }));
import { mergeRemoteSettings } from '../contexts/SettingsContext';

describe('mergeRemoteSettings', () => {
  const local = { theme: 'dark', speechRate: 0.5, textScale: 1.5, compactLayout: true };

  test('missing / null / non-object snapshots leave local settings untouched', () => {
    expect(mergeRemoteSettings(local, null)).toBe(local);
    expect(mergeRemoteSettings(local, undefined)).toBe(local);
    expect(mergeRemoteSettings(local, 'oops')).toBe(local);
    expect(mergeRemoteSettings(local, [1, 2])).toBe(local);
  });

  test('null cloud values do not erase local values', () => {
    const merged = mergeRemoteSettings(local, { speechRate: null, theme: 'light' });
    expect(merged.speechRate).toBe(0.5);
    expect(merged.theme).toBe('light');
  });

  test('keys only present locally survive a partial cloud snapshot', () => {
    const merged = mergeRemoteSettings(local, { theme: 'highContrast' });
    expect(merged).toEqual({ ...local, theme: 'highContrast' });
  });
});
