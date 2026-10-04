// "Delete my data" must leave nothing behind and nothing may come back
// afterwards (orphan files, pending debounced saves). Content is artificial.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), set: jest.fn(), get: jest.fn(), onValue: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const FileSystem = require('expo-file-system/legacy');
const { deleteLocalPersonalData } = require('../services/localData');
const photos = require('../services/tilePhotoStore');
const custom = require('../services/customVocabStore');
const { createPersistentPredictor, personalKey } = require('../services/prediction/index.js');

beforeEach(async () => {
  await AsyncStorage.clear();
  FileSystem.deleteAsync.mockClear();
  await photos.loadTilePhotos();
  await custom.loadCustomVocab({ reload: true });
});

// True when some deleteAsync call removed `path` (the file or a parent folder).
const removed = (path) => FileSystem.deleteAsync.mock.calls.some(([p]) => path.startsWith(p));

test('removes the photo files of words that are no longer in the word list', async () => {
  // A word removed elsewhere (Classic word manager, or deleted on another
  // device and merged) leaves its photo behind in the photo store.
  const kept = await custom.addCustomVocabItem('flarn', 'noun');
  const keptUri = await photos.saveTilePhoto(kept.id, 'file:///cache/pick-a.jpg');
  const orphanUri = await photos.saveTilePhoto('1234567890', 'file:///cache/pick-b.jpg');
  FileSystem.deleteAsync.mockClear();

  await deleteLocalPersonalData();

  expect(removed(keptUri)).toBe(true);
  expect(removed(orphanUri)).toBe(true);
  expect(photos.getTilePhoto('1234567890')).toBeNull();
  expect(await AsyncStorage.getItem('@voice_tile_photos_v1')).toBeNull();
});

test('a pending debounced learning save cannot re-create deleted learning', async () => {
  jest.useFakeTimers();
  try {
    const p = await createPersistentPredictor({ learningEnabled: true, debounceMs: 2000 });
    p.learnFromSpokenSentence(['vorp', 'snack', 'now']);
    await p.resetPersonal();
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    const raw = await AsyncStorage.getItem(personalKey('default'));
    expect(raw === null || JSON.parse(raw).sentences === 0).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
