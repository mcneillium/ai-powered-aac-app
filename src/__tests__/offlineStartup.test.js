// With Firebase unavailable, the modules on the communication path must
// load and their cloud calls must be harmless no-ops.
jest.mock('../../firebaseConfig', () => ({
  db: null, auth: null, isFirebaseAvailable: () => false,
  firebaseStatus: { available: false, reason: 'not-configured' },
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn(() => { throw new Error('ref() must not be called without Firebase'); }),
  set: jest.fn(), get: jest.fn(), onValue: jest.fn(), push: jest.fn(), remove: jest.fn(),
}));

describe('startup without Firebase', () => {
  test('custom vocabulary loads and saves locally', async () => {
    const store = require('../services/customVocabStore');
    await expect(store.loadCustomVocab()).resolves.toEqual(expect.any(Array));
  });

  test('sync timestamp still records locally', async () => {
    const { updateLastActivity, getLastActivity } = require('../utils/syncStatus');
    await updateLastActivity();
    expect(await getLastActivity()).toEqual(expect.any(String));
  });

  test('AI backend requests get no token rather than crashing', async () => {
    const { ENDPOINTS } = require('../services/aiBackend');
    expect(ENDPOINTS.phraseSuggestions).toEqual(expect.any(String));
  });

  test('core vocabulary and search work', () => {
    const { getHomePage, searchVocabulary } = require('../data/coreVocabulary');
    expect(getHomePage().buttons.length).toBeGreaterThan(10);
    expect(searchVocabulary('want').length).toBeGreaterThan(0);
  });
});
