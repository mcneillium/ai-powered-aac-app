// Cloud settings must never replace saved local settings with empty values.
jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), set: jest.fn() }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), signInAnonymously: jest.fn() }));
import { mergeRemoteSettings, toCloudSettings } from '../contexts/SettingsContext';

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

describe('device-only settings', () => {
  test('speechVoice and compactLayout are never written to the cloud', () => {
    const cloud = toCloudSettings({ theme: 'dark', speechVoice: 'v1', compactLayout: true, speechRate: 0.5 });
    expect(cloud).toEqual({ theme: 'dark', speechRate: 0.5 });
  });

  test('cloud values for device-only keys are ignored', () => {
    const local = { speechVoice: null, compactLayout: false };
    const merged = mergeRemoteSettings(local, { speechVoice: 'other-phone-voice', compactLayout: true });
    expect(merged).toEqual(local);
  });
});

describe('Voice 2 board choice across devices', () => {
  test('a fresh install joining a pre-Voice 2 account keeps the familiar board', () => {
    const local = { boardLayout: 'studio', boardLayoutSource: 'new-install' };
    const merged = mergeRemoteSettings(local, { theme: 'dark', speechRate: 0.7 });
    expect(merged.boardLayout).toBe('classic');
  });
  test('an explicit choice on this device is never overridden', () => {
    const local = { boardLayout: 'studio', boardLayoutSource: 'chosen' };
    expect(mergeRemoteSettings(local, { theme: 'dark' }).boardLayout).toBe('studio');
  });
  test('a Voice 2 account keeps its recorded board', () => {
    const local = { boardLayout: 'studio', boardLayoutSource: 'new-install' };
    expect(mergeRemoteSettings(local, { boardLayout: 'studio', theme: 'dark' }).boardLayout).toBe('studio');
  });
  test('mode profiles merge per mode instead of replacing', () => {
    const local = { modeProfiles: { child: { gridSize: 3, textScale: 1.25 } } };
    const merged = mergeRemoteSettings(local, { modeProfiles: { child: { gridSize: 4 }, adult: { gridSize: 5 } } });
    expect(merged.modeProfiles).toEqual({ child: { gridSize: 4, textScale: 1.25 }, adult: { gridSize: 5 } });
  });
});
