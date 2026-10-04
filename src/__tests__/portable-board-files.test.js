/* eslint-env jest */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';
import { applyPortableImport, sharePortableBoard, cancelAndDrainPortableImport, pickPortableBoard } from '../services/portable-board-files';
import { addCustomVocabItem } from '../services/customVocabStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { PORTABLE_FORMAT } from '../services/portable-board-format';
let mockItems = [];
jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: null } }));
jest.mock('../services/customVocabStore', () => ({
  loadCustomVocab: jest.fn(async () => mockItems), getCustomVocab: () => mockItems,
  addCustomVocabItem: jest.fn(async (word, category) => {
    const item = { id: String(mockItems.length + 100), word: word.toLowerCase(), category };
    mockItems.push(item);
    await require('@react-native-async-storage/async-storage').setItem('@aac_custom_vocab', JSON.stringify(mockItems));
    return item;
  }),
}));
jest.mock('../services/tilePhotoStore', () => ({ loadTilePhotos: jest.fn(), getTilePhoto: () => null, saveTilePhoto: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' }, getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false, size: 100 })), writeAsStringAsync: jest.fn(async () => {}), deleteAsync: jest.fn(async () => {}) }));
jest.mock('../services/privateExportCache', () => ({ createPrivateExportFile: jest.fn(async (extension, writer) => { const uri = `file:///cache/private-exports/test.${extension}`; await writer(uri); return uri; }) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///cache/print.pdf' })) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
const board = { format: PORTABLE_FORMAT, version: 1, personalWords: [{ word: 'special cup', category: 'noun' }] };
beforeEach(async () => { mockItems = []; auth.currentUser = null; jest.clearAllMocks(); await AsyncStorage.clear(); });
test('signed-in import requires explicit sync consent before any write', async () => {
  auth.currentUser = { uid: 'test', isAnonymous: false };
  await expect(applyPortableImport(board)).rejects.toThrow('Confirm');
  expect(addCustomVocabItem).not.toHaveBeenCalled();
});
test('additive import preserves existing items and can be retried without duplicates', async () => {
  mockItems = [{ id: 'old', word: 'existing', category: 'noun' }];
  const first = await applyPortableImport(board);
  expect(first.added).toEqual(['special cup']);
  expect(mockItems[0]).toEqual({ id: 'old', word: 'existing', category: 'noun' });
  const second = await applyPortableImport(board);
  expect(second.added).toEqual([]);
  expect(mockItems).toHaveLength(2);
});
test('sharing retains its private export when chooser closes or fails', async () => {
  Sharing.shareAsync.mockRejectedValueOnce(new Error('share unavailable'));
  await expect(sharePortableBoard(board)).rejects.toThrow('share unavailable');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});

test('picker directory and cache root are never recursively deleted', async () => {
  FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true, size: 100 }).mockResolvedValueOnce({ exists: true, isDirectory: true });
  DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/important-folder' }] });
  await expect(pickPortableBoard()).rejects.toThrow();
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/' }] });
  FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true, size: 100 });
  await expect(pickPortableBoard()).rejects.toThrow();
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
});
test('deletion drains an in-flight write and prevents further import writes', async () => {
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  addCustomVocabItem.mockImplementationOnce(async (word) => {
    started();
    await new Promise((resolve) => { release = resolve; });
    mockItems.push({ id: 'held', word });
    await AsyncStorage.setItem('@aac_custom_vocab', JSON.stringify(mockItems));
    return { id: 'held', word };
  });
  const promise = applyPortableImport({ ...board, personalWords: [...board.personalWords, { word: 'second item', category: 'noun' }] });
  const outcome = promise.catch((error) => error);
  await startedPromise;
  let drained = false;
  const drain = cancelAndDrainPortableImport().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  release();
  await drain;
  await AsyncStorage.clear();
  expect((await outcome).message).toContain('cancelled');
  expect(addCustomVocabItem).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('@aac_custom_vocab')).toBeNull();
});
