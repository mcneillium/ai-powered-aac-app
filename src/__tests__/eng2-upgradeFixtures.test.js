// Saved data after upgrade: the oldest stored shapes of settings, history,
// favourites and custom words (from v1.0 / v1.2.0, before Voice 2) load
// without loss. All content is artificial.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), update: jest.fn(), set: jest.fn(), get: jest.fn() }));

const { SettingsProvider, useSettings } = require('../contexts/SettingsContext');
const history = require('../services/sentenceHistoryStore');
const favs = require('../services/favouritesStore');
const custom = require('../services/customVocabStore');

beforeEach(async () => { await AsyncStorage.clear(); });

async function mountSettings() {
  let ctx;
  const Probe = () => { ctx = useSettings(); return null; };
  await act(async () => { TestRenderer.create(<SettingsProvider><Probe /></SettingsProvider>); });
  return ctx;
}

test('v1.0 settings (theme/grid/contrast only) keep every value and the Classic board', async () => {
  const v10 = { theme: 'highContrast', gridSize: 5, contrast: true };
  await AsyncStorage.setItem('@aac_settings', JSON.stringify(v10));
  const ctx = await mountSettings();
  expect(ctx.settings).toMatchObject({ ...v10, boardLayout: 'classic', speechRate: 1, personalLearning: false });
  expect(JSON.parse(await AsyncStorage.getItem('@aac_settings'))).toMatchObject(v10);
});

test('v1.2.0 settings with learning switched off and a legacy profile stay off', async () => {
  const v12 = { theme: 'dark', gridSize: 4, contrast: false, speechRate: 0.7, speechPitch: 1.2, speechVoice: 'voice-zz', aiPersonalisationEnabled: false };
  await AsyncStorage.setItem('@aac_settings', JSON.stringify(v12));
  await AsyncStorage.setItem('@aac_ai_profile', JSON.stringify({ totalWordSelections: 12, phraseFrequencies: { 'zib zab': 3 } }));
  const ctx = await mountSettings();
  expect(ctx.settings).toMatchObject({ ...v12, boardLayout: 'classic', personalLearning: false });
  // The legacy learning data is not deleted by the upgrade.
  expect(await AsyncStorage.getItem('@aac_ai_profile')).not.toBeNull();
});

test('v1.2.0 history, favourites and custom words load unchanged and stay usable', async () => {
  const oldHistory = [
    { text: 'plim the zorb', timestamp: 1600000000000, speakCount: 3 },
    { text: 'gax nub', timestamp: 1600000000001 }, // no speakCount
  ];
  const oldFavs = [{ id: 'fav_1600000000000', phrase: 'wib wob', createdAt: 1600000000000 }];
  const oldWords = [{ id: '1600000000000', word: 'frell', category: 'noun', source: 'manual', createdAt: 1600000000000 }];
  await AsyncStorage.setItem('@aac_sentence_history', JSON.stringify(oldHistory));
  await AsyncStorage.setItem('@aac_favourites', JSON.stringify(oldFavs));
  await AsyncStorage.setItem('@aac_custom_vocab', JSON.stringify(oldWords));

  expect(await history.loadSentenceHistory({ reload: true })).toEqual(oldHistory);
  expect(history.getFrequentSentences(2).map((h) => h.text)).toEqual(['plim the zorb', 'gax nub']);
  expect(await favs.loadFavourites({ reload: true })).toEqual(oldFavs);
  expect(favs.isFavourite('wib wob')).toBe(true);
  expect(await custom.loadCustomVocab({ reload: true })).toEqual(oldWords);
  expect(custom.getCustomButtons()[0]).toMatchObject({ id: 'custom_1600000000000', label: 'frell', category: 'noun' });

  // New writes keep the old entries.
  await history.addSentenceToHistory('new blip');
  await favs.addFavourite('new blop');
  const storedHistory = JSON.parse(await AsyncStorage.getItem('@aac_sentence_history'));
  expect(storedHistory.map((h) => h.text)).toEqual(['new blip', 'plim the zorb', 'gax nub']);
  const storedFavs = JSON.parse(await AsyncStorage.getItem('@aac_favourites'));
  expect(storedFavs.map((f) => f.phrase)).toEqual(['new blop', 'wib wob']);
});
