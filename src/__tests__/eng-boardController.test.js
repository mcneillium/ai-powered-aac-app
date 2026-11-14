// Board behaviour that is easy to break: Undo after Clear, and the board
// showing data the user has just deleted. Content is artificial.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), set: jest.fn(), get: jest.fn(), onValue: jest.fn() }));

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => mockFocused,
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../components/QuickRepairOverlay', () => ({ setQuickPhrasesButtonHidden: () => {} }));
jest.mock('../services/vertexAISuggestions', () => ({ getAACPhraseSuggestions: async () => [] }));
jest.mock('../services/speechService', () => ({
  speak: jest.fn(async () => {}),
  stop: jest.fn(async () => {}),
  buildSpeechOptions: () => ({}),
  subscribeSpeechStatus: () => () => {},
}));
jest.mock('../contexts/SettingsContext', () => {
  const settings = { theme: 'light', gridSize: 3, speakWordsOnTap: false, predictionEnabled: false, boardLayout: 'studio' };
  const updateSettings = () => {};
  return { useSettings: () => ({ settings, updateSettings }) };
});

const { useBoardController } = require('../screens/useBoardController');
const { deleteLocalPersonalData } = require('../services/localData');
const history = require('../services/sentenceHistoryStore');
const favourites = require('../services/favouritesStore');

async function mount() {
  let ctl;
  const Probe = () => { ctl = useBoardController(); return null; };
  let r;
  await act(async () => { r = TestRenderer.create(<Probe />); });
  return { get: () => ctl, update: async () => { await act(async () => { r.update(<Probe />); }); }, r };
}

beforeEach(async () => {
  mockFocused = true;
  await AsyncStorage.clear();
  await history.loadSentenceHistory({ reload: true });
  await favourites.loadFavourites({ reload: true });
});

test('a second Clear on an empty message keeps Undo (accidental double tap)', async () => {
  const b = await mount();
  await act(async () => { b.get().addWords(['zorb', 'likes', 'tea']); });
  await act(async () => { b.get().clearSentence(); });
  expect(b.get().undoWords).toEqual(['zorb', 'likes', 'tea']);
  await act(async () => { b.get().clearSentence(); }); // double tap
  await act(async () => { b.get().undo(); });
  expect(b.get().sentenceWords).toEqual(['zorb', 'likes', 'tea']);
  b.r.unmount();
});

test('Clear stops speech, even when the message is already empty', async () => {
  const speech = require('../services/speechService');
  const b = await mount();
  speech.stop.mockClear();
  await act(async () => { b.get().clearSentence(); });
  expect(speech.stop).toHaveBeenCalledTimes(1);
  await act(async () => { b.get().addWords(['plim']); });
  await act(async () => { b.get().clearSentence(); });
  expect(speech.stop).toHaveBeenCalledTimes(2);
  b.r.unmount();
});

test('Undo after Clear restores the message, and a new word ends Undo', async () => {
  const b = await mount();
  await act(async () => { b.get().addWords(['blip', 'go']); });
  await act(async () => { b.get().clearSentence(); });
  await act(async () => { b.get().undo(); });
  expect(b.get().sentenceWords).toEqual(['blip', 'go']);
  await act(async () => { b.get().clearSentence(); });
  await act(async () => { b.get().addWords(['new']); });
  expect(b.get().undoWords).toBeNull();
  b.r.unmount();
});

test('after "Delete my data" the board no longer lists deleted messages or favourites', async () => {
  const b = await mount();
  await act(async () => { b.get().addWords(['quix', 'blue']); });
  await act(async () => { await b.get().speakSentence(); });
  await act(async () => { await b.get().handleToggleFavourite(); });
  expect(b.get().history.map((h) => h.text)).toEqual(['quix blue']);
  expect(b.get().favourites.map((f) => f.phrase)).toEqual(['quix blue']);

  // The user leaves the board (tabs stay mounted), deletes, and comes back.
  mockFocused = false;
  await b.update();
  await act(async () => { await deleteLocalPersonalData(); });
  mockFocused = true;
  await b.update();

  expect(b.get().history).toEqual([]);
  expect(b.get().favourites).toEqual([]);
  b.r.unmount();
});
