// Upgrading to Voice 2 must keep existing users on the board they know and
// keep every saved setting; only new installs start on the new board.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn(), set: jest.fn() }));

const { SettingsProvider, useSettings } = require('../contexts/SettingsContext');

async function mount() {
  let ctx;
  const Probe = () => { ctx = useSettings(); return null; };
  await act(async () => { TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>); });
  return () => ctx;
}

beforeEach(async () => { await AsyncStorage.clear(); });

test('existing user with saved settings keeps Classic and every value', async () => {
  const saved = { theme: 'dark', textScale: 1.5, gridSize: 4, speechRate: 0.6, compactLayout: true };
  await AsyncStorage.setItem('@aac_settings', JSON.stringify(saved));
  const ctx = await mount();
  expect(ctx().settings).toMatchObject({ ...saved, boardLayout: 'classic', uiMode: null });
  const stored = JSON.parse(await AsyncStorage.getItem('@aac_settings'));
  expect(stored).toMatchObject({ ...saved, boardLayout: 'classic' });
});

test('existing user who never changed a setting (onboarding done) keeps Classic', async () => {
  await AsyncStorage.setItem('hasLaunched', 'true');
  const ctx = await mount();
  expect(ctx().settings.boardLayout).toBe('classic');
});

test('a new install starts on the new board with learning off', async () => {
  const ctx = await mount();
  expect(ctx().settings.boardLayout).toBe('studio');
  expect(ctx().settings.personalLearning).toBe(false);
  expect(ctx().settings.cloudSuggestionsEnabled).toBe(false);
});

test('switching mode and back keeps per-mode choices and shared data', async () => {
  const ctx = await mount();
  await act(async () => { await ctx().updateSettings({ uiMode: 'child' }); });
  await act(async () => { await ctx().updateSettings({ textScale: 1.25, speechRate: 0.7 }); });
  await act(async () => { await ctx().updateSettings({ uiMode: 'adult' }); });
  expect(ctx().settings.textScale).toBe(1.25); // carried over on first use of Adult
  await act(async () => { await ctx().updateSettings({ textScale: 1 }); });
  await act(async () => { await ctx().updateSettings({ uiMode: 'child' }); });
  expect(ctx().settings.textScale).toBe(1.25);
  expect(ctx().settings.speechRate).toBe(0.7);
});
