// Coordinator fixes from the agent-team run (findings by voice-prediction
// and voice-engineer that crossed their file ownership).
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn(), set: jest.fn(), get: jest.fn() }));

const { SettingsProvider, useSettings } = require('../contexts/SettingsContext');
const localData = require('../services/localData');
const aiProfile = require('../services/aiProfileStore');

beforeEach(async () => { await AsyncStorage.clear(); });

async function mount() {
  let ctx;
  const Probe = () => { ctx = useSettings(); return null; };
  await act(async () => { TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return () => ctx;
}

test('unreadable saved settings are an existing user: no new-install board, learning choice not re-decided', async () => {
  // An earlier version with learning data, and a settings file that cannot be parsed.
  await AsyncStorage.setItem('@aac_settings', '{not json');
  await aiProfile.loadAIProfile();
  await aiProfile.recordSentenceSpoken(['i', 'want', 'juice']);
  await aiProfile.recordSentenceSpoken(['i', 'want', 'juice']);
  await aiProfile.flushAIProfile();
  const ctx = await mount();
  expect(ctx().settings.boardLayout).toBe('classic');
  expect(ctx().settings.personalLearning).toBe(false);
});

test('"Delete what Voice has learned" also clears the older usage profile', async () => {
  await aiProfile.loadAIProfile();
  await aiProfile.recordWordSelection('zebedee', ['see'], false);
  await aiProfile.flushAIProfile();
  expect(aiProfile.getTopWords(5)).toContain('zebedee');
  await localData.deleteLearnedData();
  await aiProfile.loadAIProfile();
  expect(aiProfile.getTopWords(5)).not.toContain('zebedee');
});

test('"Delete my words and messages" also removes unreadable-data backups', async () => {
  await AsyncStorage.setItem('@aac_sentence_history__corrupt', 'old private text');
  await AsyncStorage.setItem('@aac_favourites__corrupt', 'old private text');
  await localData.deleteLocalPersonalData();
  expect(await AsyncStorage.getItem('@aac_sentence_history__corrupt')).toBeNull();
  expect(await AsyncStorage.getItem('@aac_favourites__corrupt')).toBeNull();
});
