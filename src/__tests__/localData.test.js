// "Delete my data" must remove every personal store, including the ones
// added in Voice 2, and empty the in-memory copies too.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), set: jest.fn(), get: jest.fn(), onValue: jest.fn() }));

const { deleteLocalPersonalData, PERSONAL_KEYS } = require('../services/localData');
const favourites = require('../services/favouritesStore');
const history = require('../services/sentenceHistoryStore');
const custom = require('../services/customVocabStore');
const { personalKey } = require('../services/prediction/index.js');
const engine = require('../services/suggestionEngine');

beforeEach(async () => { await AsyncStorage.clear(); });

test('removes messages, favourites, words, learning; keeps settings', async () => {
  await AsyncStorage.setItem('@aac_settings', JSON.stringify({ theme: 'dark' }));
  await favourites.loadFavourites({ reload: true });
  await favourites.addFavourite('see you at the park');
  await history.loadSentenceHistory({ reload: true });
  await history.addSentenceToHistory('I want juice');
  await custom.loadCustomVocab({ reload: true });
  await custom.addCustomVocabItem('grandma', 'noun');
  engine.setLearningEnabled(true);
  for (let i = 0; i < 3; i++) engine.learnFromSpoken(['see', 'grandma', 'zebedee']);

  await deleteLocalPersonalData();

  expect(favourites.getFavourites()).toEqual([]);
  expect(history.getSentenceHistory()).toEqual([]);
  expect(custom.getCustomVocab()).toEqual([]);
  expect(engine.getLearningStats().sentences).toBe(0);
  for (const k of PERSONAL_KEYS) expect(await AsyncStorage.getItem(k)).toBeNull();
  expect(await AsyncStorage.getItem('@aac_settings')).not.toBeNull();
  engine.setLearningEnabled(false);
});

test('account deletion also removes settings', async () => {
  await AsyncStorage.setItem('@aac_settings', JSON.stringify({ theme: 'dark' }));
  await deleteLocalPersonalData({ includeSettings: true });
  expect(await AsyncStorage.getItem('@aac_settings')).toBeNull();
});

test('the learned-prediction key is in the list', () => {
  expect(PERSONAL_KEYS).toContain(personalKey('default'));
});
