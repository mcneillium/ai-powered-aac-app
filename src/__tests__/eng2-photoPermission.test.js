// Adding a photo to a word tile (Personalise > My words): camera permission
// denied, picker cancelled, or picker failing must not crash, must leave the
// tile without a photo and (except for a deliberate cancel) tell the user.
// Unit/integration level with mocked expo-image-picker; no real camera.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../firebaseConfig', () => ({ db: null, auth: null, isFirebaseAvailable: () => false }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), set: jest.fn(), get: jest.fn(), onValue: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../contexts/SettingsContext', () => {
  const settings = { theme: 'light', uiMode: 'adult', boardLayout: 'studio', textScale: 1, editLock: false };
  return { useSettings: () => ({ settings, updateSettings: jest.fn() }) };
});
jest.mock('../services/tilePhotoStore', () => ({
  tilePhotoGeneration: jest.fn(() => 0),
  saveTilePhoto: jest.fn(async () => 'file:///docs/tiles/x.jpg'),
  removeTilePhoto: jest.fn(async () => {}),
  getTilePhoto: jest.fn(() => null),
}));

const ImagePicker = require('expo-image-picker');
const { Platform } = require('react-native');
const StudioScreen = require('../screens/StudioScreen').default;

jest.setTimeout(30000); // first render loads the whole design system

let tree;
beforeEach(async () => {
  Platform.OS = 'android';
  jest.clearAllMocks();
  await act(async () => { tree = TestRenderer.create(<StudioScreen />); });
});
afterEach(() => { act(() => tree.unmount()); });

const pressLabel = async (label) => {
  const btn = tree.root.findAll((n) => n.props && n.props.label === label && typeof n.props.onPress === 'function')[0];
  expect(btn).toBeTruthy();
  await act(async () => { await btn.props.onPress(); });
};
const text = () => JSON.stringify(tree.toJSON());
const hasRemovePhoto = () => tree.root.findAll((n) => n.props && n.props.label === 'Remove photo').length > 0;

test('camera permission denied: picker not opened, no photo, user told', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  await pressLabel('Take photo');
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(hasRemovePhoto()).toBe(false);
  expect(text()).toContain('Camera permission was not given');
});

test('cancelled camera and gallery leave the tile without a photo and no error', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  await pressLabel('Take photo');
  await pressLabel('Choose photo');
  expect(hasRemovePhoto()).toBe(false);
  expect(text()).not.toContain('could not be opened');
});

test('a picker that throws (or a permission request that throws) is reported, not a crash', async () => {
  ImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error('picker unavailable'));
  await pressLabel('Choose photo');
  expect(text()).toContain('The photo could not be opened');
  ImagePicker.requestCameraPermissionsAsync.mockRejectedValue(new Error('no camera'));
  await pressLabel('Take photo');
  expect(hasRemovePhoto()).toBe(false);
});

test('a chosen photo shows in the preview and can be removed again', async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/pick.jpg' }] });
  await pressLabel('Choose photo');
  expect(hasRemovePhoto()).toBe(true);
  await pressLabel('Remove photo');
  expect(hasRemovePhoto()).toBe(false);
});
