// Saved data after upgrade: tile photos saved by the first Voice 2 build were
// stored as absolute file:// URIs. On iOS the app container path changes after
// an update or restore, so those URIs point at a folder that no longer exists.
// Photos are always copied into <documents>/tiles/, so the file name is
// enough to find them again. Paths and ids below are artificial.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///containers/NEW-0000/Documents/',
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const FileSystem = require('expo-file-system/legacy');
const photos = require('../services/tilePhotoStore');

const KEY = '@voice_tile_photos_v1';
const NEW_DIR = 'file:///containers/NEW-0000/Documents/tiles/';
const OLD_ABS = 'file:///containers/OLD-1111/Documents/tiles/111-1700000000000.jpg';

beforeEach(async () => {
  await AsyncStorage.clear();
  FileSystem.deleteAsync.mockClear();
});

test('an absolute photo path from an older build resolves in the current documents folder', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({
    111: OLD_ABS,                       // first Voice 2 build (absolute)
    222: '222-1700000000001.jpg',       // current format (file name)
  }));
  await photos.loadTilePhotos();
  expect(photos.getTilePhoto('111')).toBe(`${NEW_DIR}111-1700000000000.jpg`);
  expect(photos.getTilePhoto('222')).toBe(`${NEW_DIR}222-1700000000001.jpg`);
  // Nothing was lost from storage.
  expect(Object.keys(JSON.parse(await AsyncStorage.getItem(KEY)))).toEqual(['111', '222']);
});

test('replacing an old absolute photo deletes the old file at its current location', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ 111: OLD_ABS }));
  await photos.loadTilePhotos();
  await photos.saveTilePhoto('111', 'file:///cache/pick-new.jpg');
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(`${NEW_DIR}111-1700000000000.jpg`, { idempotent: true });
});

test('non-tile URIs (picker cache, content://) are kept as stored', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ 333: 'file:///cache/ImagePicker/x.jpg', 444: 'content://media/9' }));
  await photos.loadTilePhotos();
  expect(photos.getTilePhoto('333')).toBe('file:///cache/ImagePicker/x.jpg');
  expect(photos.getTilePhoto('444')).toBe('content://media/9');
});

test('a stored "tiles/.." path never resolves to (and deletes) the documents folder', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ 555: 'file:///containers/OLD-1111/Documents/tiles/..' }));
  await photos.loadTilePhotos();
  expect(photos.getTilePhoto('555')).not.toBe(`${NEW_DIR}..`);
  await photos.removeTilePhoto('555');
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(`${NEW_DIR}..`, expect.anything());
});
