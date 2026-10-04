import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';

let mockSettings = { theme: 'light', boardLayout: 'studio', editLock: false };
let mockPrevent;
let mockScanItems = [];
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  usePreventRemove: (enabled, callback) => { mockPrevent = { enabled, callback }; },
  StackActions: { popTo: (name, params) => ({ type: 'POP_TO', payload: { name, params } }) },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('../contexts/SettingsContext', () => ({ useSettings: () => ({ settings: mockSettings }) }));
jest.mock('../components/studio/VisualMessage', () => ({ VisualMessage: () => null }));
jest.mock('../services/speechService', () => ({ speak: jest.fn(), stop: jest.fn(), buildSpeechOptions: () => ({}) }));
jest.mock('../hooks/useOverlayScan', () => ({ useOverlayScan: (_active, items) => { mockScanItems = items; return null; } }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../services/communication-transfer', () => ({ shareSceneBackup: jest.fn(), pickSceneBackup: jest.fn(), shareScenePdf: jest.fn() }));
jest.mock('../services/communication-scenes', () => ({
  loadScenes: jest.fn(async () => [{ id: 'kitchen', name: 'Kitchen', photo: 'data:image/jpeg;base64,YQ==', points: [{ id: 'water', label: 'Water', phrase: 'I want water', x: 0.5, y: 0.5 }] }]),
  saveScenes: jest.fn(async () => {}), getScenesGeneration: () => 0, subscribeScenesDeletion: () => () => {}, parseScenePack: jest.fn(),
}));

const Workspace = require('../screens/ConversationWorkspaceScreen').default;
const Tools = require('../screens/CommunicationToolsScreen').default;
const conversation = require('../services/conversation-workspace');
const scan = require('../services/switchScanService');
const speech = require('../services/speechService');
const picker = require('expo-image-picker');
const transfer = require('../services/communication-transfer');
const scenes = require('../services/communication-scenes');
let root;
const navigation = { dispatch: jest.fn(), goBack: jest.fn(), setParams: jest.fn() };
const button = label => root.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const input = label => root.root.findAllByType(TextInput).find(n => n.props.accessibilityLabel === label);
async function mount(Component, params = {}, options = {}) { await act(async () => { root = Renderer.create(<Component navigation={navigation} route={{ params }} />, options); }); }
async function press(label) { await act(async () => { await button(label).props.onPress(); }); }
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSettings = { theme: 'light', boardLayout: 'studio', editLock: false };
  await conversation.clearConversationWorkspace();
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; scan.stopScan(); jest.restoreAllMocks(); });

test('edited workspace draft prevents accidental back and Save and leave persists before dispatch', async () => {
  await mount(Workspace, { message: 'original message' });
  expect(mockPrevent.enabled).toBe(false);
  await act(async () => input('Current conversation draft').props.onChangeText('edited message'));
  expect(mockPrevent.enabled).toBe(true);
  const action = { type: 'GO_BACK' };
  await act(async () => mockPrevent.callback({ data: { action } }));
  expect(navigation.dispatch).not.toHaveBeenCalled();
  const save = Alert.alert.mock.calls.at(-1)[2].find(b => b.text === 'Save and leave');
  await act(async () => save.onPress());
  expect((await conversation.listConversationDrafts())[0].text).toBe('edited message');
  expect(navigation.dispatch).toHaveBeenCalledWith(action);
});

test.each([['studio', 'Talk'], ['classic', 'AAC Board']])('Use on board returns to the correct %s route and queues exact words without speaking', async (layout, screen) => {
  mockSettings.boardLayout = layout;
  await mount(Workspace, { message: 'I need a quiet room' });
  await press('Use on board');
  expect(conversation.consumeWorkspaceReturn()).toBe('I need a quiet room');
  expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'POP_TO', payload: { name: 'App', params: { screen } } });
  expect(speech.speak).not.toHaveBeenCalled();
});

test('workspace scanning includes an editable message target', async () => {
  const setItems = jest.spyOn(scan, 'setScanItems');
  await mount(Workspace, { message: 'hello' });
  await press('Start workspace scanning');
  expect(scan.getScanState().currentIndex).toBe(0);
  expect(setItems.mock.calls.at(-1)[0]).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'draft-input', label: 'Current conversation draft', onSelect: expect.any(Function) })]));
});

test('workspace scan selection focuses the message field', async () => {
  await mount(Workspace, { message: 'hello' });
  const focus = jest.spyOn(input('Current conversation draft').instance, 'focus');
  await press('Start workspace scanning');
  await act(async () => scan.selectCurrent());
  expect(focus).toHaveBeenCalledTimes(1);
});

test('locked photo scenes retain phrase speech and scan targets but hide mutations', async () => {
  mockSettings.editLock = true;
  await mount(Tools);
  expect(button('Edit points')).toBeUndefined();
  expect(button('Choose photo and create scene')).toBeUndefined();
  await press('1. Water');
  expect(mockScanItems).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Speak: Water' })]));
  await press('Speak: Water');
  expect(speech.speak).toHaveBeenCalledWith('I want water', {});
  await press('Backup');
  expect(button('Choose scene backup file')).toBeUndefined();
  expect(button('Share scene backup')).toBeDefined();
});

test('photo picker failure is visible and existing scenes remain usable', async () => {
  picker.launchImageLibraryAsync.mockRejectedValueOnce(new Error('permission failed'));
  await mount(Tools);
  await act(async () => input('Name for new scene').props.onChangeText('Garden'));
  await press('Choose photo and create scene');
  expect(Alert.alert).toHaveBeenCalledWith('Could not complete this action', expect.stringContaining('not been replaced'));
  expect(scenes.saveScenes).not.toHaveBeenCalled();
  expect(button('Choose photo and create scene').props.disabled).toBe(false);
  expect(button('1. Water')).toBeDefined();
});

test('failed scene import releases busy state without offering replacement', async () => {
  transfer.pickSceneBackup.mockRejectedValueOnce(new Error('bad file'));
  await mount(Tools);
  await press('Backup');
  await press('Choose scene backup file');
  expect(Alert.alert).toHaveBeenCalledWith('Cannot import', expect.stringContaining('unchanged'));
  expect(button('Choose scene backup file').props.disabled).toBe(false);
  expect(button('Replace scenes with this import')).toBeUndefined();
});
