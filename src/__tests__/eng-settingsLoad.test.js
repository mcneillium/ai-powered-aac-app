// Settings must survive a re-render of the provider while they are still
// being read at startup (e.g. the signed-in user arriving from Firebase
// Auth). Before the fix such a render reset the in-progress copy to the
// defaults, which were then saved over the user's settings.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn(), set: jest.fn(), get: jest.fn() }));

const { SettingsProvider, useSettings } = require('../contexts/SettingsContext');

beforeEach(async () => { await AsyncStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

test('a render during the startup read keeps the saved settings (existing user)', async () => {
  const saved = { theme: 'dark', gridSize: 5, textScale: 1.5, speechRate: 0.6 };
  // Hold the second startup read so a render can happen in between.
  let release;
  const gate = new Promise((r) => { release = r; });
  const values = { '@aac_settings': JSON.stringify(saved), hasLaunched: 'true' };
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
    if (key === 'hasLaunched') await gate;
    return values[key] ?? null;
  });
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, v) => { values[key] = v; });

  let ctx;
  const Probe = () => { ctx = useSettings(); return null; };
  let r;
  await act(async () => { r = TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>); });
  // Something above the provider re-renders while the read is held.
  await act(async () => { r.update(<SettingsProvider><Probe /></SettingsProvider>); });
  await act(async () => { release(); });

  expect(ctx.settings).toMatchObject({ ...saved, boardLayout: 'classic' });
  const stored = JSON.parse(values['@aac_settings']);
  expect(stored).toMatchObject({ ...saved, boardLayout: 'classic' });
});
