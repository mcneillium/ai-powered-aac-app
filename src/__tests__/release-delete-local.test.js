import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { deleteUser } from 'firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';
import { confirmDeleteAccount } from '../services/accountActions';
import { resumeAccountDataSync } from '../services/accountDeletionBarrier';

jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'synthetic-user' } }, db: {} }));
jest.mock('firebase/auth', () => ({ deleteUser: jest.fn(async () => {}), signOut: jest.fn() }));
jest.mock('firebase/database', () => ({ ref: jest.fn((_db, path) => path), remove: jest.fn(async () => {}) }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///synthetic/', deleteAsync: jest.fn(async () => {}) }));
jest.mock('../services/prediction/index.js', () => ({ personalKey: () => '@synthetic_prediction', DEFAULT_PROFILE_ID: 'default' }));
jest.mock('../services/suggestionEngine', () => ({ resetLearning: jest.fn(async () => {}) }));
jest.mock('../services/favouritesStore', () => ({ loadFavourites: jest.fn(async () => {}) }));
jest.mock('../services/sentenceHistoryStore', () => ({ loadSentenceHistory: jest.fn(async () => {}) }));
jest.mock('../services/customVocabStore', () => ({ loadCustomVocab: jest.fn(async () => {}) }));
jest.mock('../services/pronunciationStore', () => ({ loadPronunciations: jest.fn(async () => {}) }));
jest.mock('../services/aiProfileStore', () => ({ loadAIProfile: jest.fn(async () => {}), resetAIProfile: jest.fn(async () => {}) }));
jest.mock('../services/privateExportCache', () => ({ clearPrivateExports: jest.fn(async () => {}) }));
jest.mock('../services/portable-board-files', () => ({ cancelAndDrainPortableImport: jest.fn(async () => {}) }));

const originalMultiRemove = AsyncStorage.multiRemove.getMockImplementation();
const originalRemoveItem = AsyncStorage.removeItem.getMockImplementation();
let alert;
beforeEach(async () => {
  resumeAccountDataSync();
  AsyncStorage.multiRemove.mockImplementation(originalMultiRemove);
  AsyncStorage.removeItem.mockImplementation(originalRemoveItem);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const startDelete = () => {
  confirmDeleteAccount();
  return alert.mock.calls[0][2].find(button => button.style === 'destructive').onPress();
};

test('a real personal-key removal failure reaches the account deletion caller', async () => {
  const failing = jest.spyOn(AsyncStorage, 'multiRemove').mockImplementation(keys => keys.length > 1 ? Promise.reject(new Error('synthetic disk failure')) : originalMultiRemove(keys));
  await startDelete();
  expect(failing).toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
  expect(alert).toHaveBeenLastCalledWith('Deletion Incomplete', expect.any(String));
});

test('an actual photo-file removal failure prevents Auth deletion', async () => {
  FileSystem.deleteAsync.mockRejectedValueOnce(new Error('synthetic file failure'));
  await startDelete();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///synthetic/tiles/', { idempotent: true });
  expect(deleteUser).not.toHaveBeenCalled();
});

test('a failed local photo-index removal also prevents Auth deletion', async () => {
  jest.spyOn(AsyncStorage, 'removeItem').mockImplementation(key => key === '@voice_tile_photos_v1' ? Promise.reject(new Error('synthetic write failure')) : Promise.resolve());
  await startDelete();
  expect(deleteUser).not.toHaveBeenCalled();
});
