import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Button, TextInput } from 'react-native';
let mockUser = null;
let mockAuthListener;
jest.mock('../../firebaseConfig', () => ({ auth: { get currentUser() { return mockUser; } }, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth, callback) => { mockAuthListener = callback; callback(mockUser); return () => {}; }),
  signInAnonymously: jest.fn(),
}));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), onValue: jest.fn(), update: jest.fn() }));
jest.mock('../services/arasaacService', () => ({ searchPictograms: jest.fn() }));
jest.mock('../utils/syncStatus', () => ({ updateLastActivity: jest.fn() }));
jest.mock('../services/speechService', () => ({ speak: jest.fn(), buildSpeechOptions: () => ({}) }));
jest.mock('../services/suggestionEngine', () => ({ suggestNext: () => [], importLegacyLearning: jest.fn() }));
const { AuthProvider } = require('../contexts/AuthContext');
const { SettingsProvider, useSettings, SettingsContext, defaultSettings, mergeRemoteSettings, toCloudSettings } = require('../contexts/SettingsContext');
const Builder = require('../screens/EasySentenceBuilderScreen').default;
const { signInAnonymously } = require('firebase/auth');
const { callAIBackend } = require('../services/aiBackend');
const { searchPictograms } = require('../services/arasaacService');
const { resumeAccountDataSync, beginAccountDeletion } = require('../services/accountDeletionBarrier');
let root;
beforeEach(() => { jest.clearAllMocks(); mockUser = null; resumeAccountDataSync(); global.fetch = jest.fn(); });
afterEach(() => { if (root) act(() => root.unmount()); root = null; jest.restoreAllMocks(); });

test('remote settings cannot enable or disable this device learning/cloud consent', () => {
  const local = { personalLearning: false, aiPersonalisationEnabled: false, cloudSuggestionsEnabled: false };
  expect(mergeRemoteSettings(local, { personalLearning: true, aiPersonalisationEnabled: true, cloudSuggestionsEnabled: true })).toEqual(local);
  expect(toCloudSettings({ ...local, theme: 'dark' })).toEqual({ theme: 'dark' });
  const chosen = { personalLearning: true, cloudSuggestionsEnabled: true };
  expect(mergeRemoteSettings(chosen, { personalLearning: false, cloudSuggestionsEnabled: false })).toEqual(chosen);
});
test('opening Voice as a local guest does not create an anonymous account', async () => {
  await act(async () => { root = Renderer.create(<AuthProvider><React.Fragment /></AuthProvider>); });
  expect(mockAuthListener).toBeDefined();
  expect(signInAnonymously).not.toHaveBeenCalled();
});
test('explicit concurrent cloud requests share one guest authentication', async () => {
  let release;
  signInAnonymously.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  const first = callAIBackend('https://example.invalid/one', {});
  const second = callAIBackend('https://example.invalid/two', {});
  expect(signInAnonymously).toHaveBeenCalledTimes(1);
  release({ user: { getIdToken: async () => 'synthetic-token' } });
  await Promise.all([first, second]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token');
});
test('typing stays local; cancelled online search sends nothing; failed approved search retains offline words', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => { root = Renderer.create(<SettingsContext.Provider value={{ settings: defaultSettings, loading: false }}><Builder /></SettingsContext.Provider>); });
  await act(async () => root.root.findByType(TextInput).props.onChangeText('water'));
  expect(searchPictograms).not.toHaveBeenCalled();
  const online = root.root.findAllByType(Button).find(n => n.props.title === 'Find pictures online');
  act(() => online.props.onPress());
  expect(searchPictograms).not.toHaveBeenCalled();
  const buttons = Alert.alert.mock.calls.at(-1)[2];
  expect(buttons[0].style).toBe('cancel');
  searchPictograms.mockResolvedValueOnce(null);
  await act(async () => buttons[1].onPress());
  expect(searchPictograms).toHaveBeenCalledWith('en', 'water');
  expect(root.root.findAll(n => n.props.accessibilityLabel === 'Add water').length).toBeGreaterThan(0);
});

test('initial guest auth observation does not discard settings loaded after its callback', async () => {
  let release;
  let observed;
  AsyncStorage.getItem.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  function Probe() { observed = useSettings(); return null; }
  await act(async () => { root = Renderer.create(<AuthProvider><SettingsProvider><Probe /></SettingsProvider></AuthProvider>); });
  await act(async () => release(JSON.stringify({ ...defaultSettings, theme: 'dark', speechRate: 0.5 })));
  expect(observed.loading).toBe(false);
  expect(observed.settings.theme).toBe('dark');
  expect(observed.settings.speechRate).toBe(0.5);
});

test('a delayed corrupt initial settings read cannot recreate its backup during deletion', async () => {
  let release;
  AsyncStorage.getItem.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => { root = Renderer.create(<AuthProvider><SettingsProvider><React.Fragment /></SettingsProvider></AuthProvider>); });
  const deleting = beginAccountDeletion();
  await act(async () => { release('{synthetic-corrupt'); await deleting; });
  expect(await AsyncStorage.getItem('@aac_settings__corrupt')).toBeNull();
});
