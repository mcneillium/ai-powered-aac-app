import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import { loadTilePhotos, getTilePhoto, saveTilePhoto, removeAllTilePhotos, tilePhotoGeneration } from '../services/tilePhotoStore';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///synthetic-docs/',
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const originalSet = AsyncStorage.setItem.getMockImplementation();
const originalGet = AsyncStorage.getItem.getMockImplementation();
beforeEach(async () => {
  resumeAccountDataSync();
  AsyncStorage.setItem.mockImplementation(originalSet);
  AsyncStorage.getItem.mockImplementation(originalGet);
  FileSystem.copyAsync.mockResolvedValue(undefined);
  await removeAllTilePhotos({ strict: true });
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('local deletion drains a copy and removes its files after the stale save is cancelled', async () => {
  const copy = deferred();
  const order = [];
  FileSystem.copyAsync.mockImplementationOnce(() => copy.promise.then(() => { order.push('copy finished'); }));
  FileSystem.deleteAsync.mockImplementationOnce(async () => { order.push('folder removed'); });
  const saved = saveTilePhoto('synthetic-tile', 'file:///synthetic-picker.jpg');
  const cancelled = expect(saved).rejects.toThrow('cancelled');
  await flush();
  expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
  let removed = false;
  const deleting = removeAllTilePhotos({ strict: true }).then(() => { removed = true; });
  await flush();
  expect(removed).toBe(false);
  copy.resolve();
  await Promise.all([cancelled, deleting]);
  expect(order).toEqual(['copy finished', 'folder removed']);
  expect(getTilePhoto('synthetic-tile')).toBeNull();
  expect(await AsyncStorage.getItem('@voice_tile_photos_v1')).toBeNull();
});

test('a storage write already in flight completes before the photo index purge', async () => {
  const write = deferred();
  AsyncStorage.setItem.mockImplementationOnce((key, value) => write.promise.then(() => originalSet(key, value)));
  const saved = saveTilePhoto('synthetic-tile', 'file:///synthetic-picker.jpg');
  const cancelled = expect(saved).rejects.toThrow('cancelled');
  await flush();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  const deleting = removeAllTilePhotos({ strict: true });
  write.resolve();
  await Promise.all([cancelled, deleting]);
  expect(await AsyncStorage.getItem('@voice_tile_photos_v1')).toBeNull();
  expect(getTilePhoto('synthetic-tile')).toBeNull();
});

test('a delayed photo load cannot restore the old in-memory index after deletion', async () => {
  const read = deferred();
  AsyncStorage.getItem.mockReturnValueOnce(read.promise);
  const loading = loadTilePhotos();
  await flush();
  const deleting = removeAllTilePhotos({ strict: true });
  read.resolve(JSON.stringify({ stale: 'stale-photo.jpg' }));
  await Promise.all([loading, deleting]);
  expect(getTilePhoto('stale')).toBeNull();
});

test('a picker generation captured before deletion is refused, while a newly chosen photo still saves', async () => {
  const beforePicker = tilePhotoGeneration();
  await removeAllTilePhotos({ strict: true });
  await expect(saveTilePhoto('stale', 'file:///synthetic-picker.jpg', beforePicker)).rejects.toThrow('cancelled');
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  const uri = await saveTilePhoto('fresh', 'file:///new-synthetic-picker.jpg', tilePhotoGeneration());
  expect(getTilePhoto('fresh')).toBe(uri);
});

test('account deletion drains photo work and rejects later photo saves while paused', async () => {
  const copy = deferred();
  FileSystem.copyAsync.mockReturnValueOnce(copy.promise);
  const saved = saveTilePhoto('pending', 'file:///synthetic-picker.jpg');
  const cancelled = expect(saved).rejects.toThrow('cancelled');
  await flush();
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  await expect(saveTilePhoto('late', 'file:///synthetic-picker.jpg')).rejects.toThrow('cancelled');
  copy.resolve();
  await Promise.all([cancelled, deleting]);
  await removeAllTilePhotos({ strict: true });
  expect(await AsyncStorage.getItem('@voice_tile_photos_v1')).toBeNull();
  expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
});
