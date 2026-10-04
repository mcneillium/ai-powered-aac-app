import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextInput } from 'react-native';
import { push } from 'firebase/database';
import FeedbackScreen from '../screens/FeedbackScreen';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';

jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'synthetic-feedback-user' } }, db: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn((_db, path) => path), push: jest.fn(async () => {}) }));
jest.mock('../contexts/SettingsContext', () => ({ useSettings: () => ({ settings: { theme: 'light', boardLayout: 'studio' }, loading: false }) }));
jest.mock('../contexts/NetworkContext', () => ({ useNetwork: () => ({ isOnline: true }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

let root;
beforeEach(async () => { resumeAccountDataSync(); await AsyncStorage.clear(); jest.clearAllMocks(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

test('an in-flight feedback flush is drained and cannot rewrite the local queue after deletion', async () => {
  await AsyncStorage.setItem('@aac_feedback_queue', JSON.stringify([{ feedback: 'synthetic feedback', timestamp: 1 }]));
  let finish;
  push.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => { root = Renderer.create(<FeedbackScreen />); });
  expect(push).toHaveBeenCalledTimes(1);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  finish();
  await deleting;
  await AsyncStorage.removeItem('@aac_feedback_queue');
  await act(async () => { await Promise.resolve(); });
  expect(await AsyncStorage.getItem('@aac_feedback_queue')).toBeNull();
});

test('submitting feedback during deletion does not send or save it', async () => {
  await act(async () => { root = Renderer.create(<FeedbackScreen />); });
  const input = root.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Your feedback');
  await act(async () => input.props.onChangeText('synthetic feedback'));
  await beginAccountDeletion();
  const submit = root.root.findAll(node => node.props.accessibilityLabel === 'Submit feedback' && typeof node.props.onPress === 'function')[0];
  await act(async () => { await submit.props.onPress(); });
  expect(push).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@aac_feedback_queue')).toBeNull();
});


test('a send failure during deletion cannot fall back to a new local feedback entry', async () => {
  await act(async () => { root = Renderer.create(<FeedbackScreen />); });
  const input = root.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Your feedback');
  await act(async () => input.props.onChangeText('synthetic feedback'));
  let fail;
  push.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
  const submit = root.root.findAll(node => node.props.accessibilityLabel === 'Submit feedback' && typeof node.props.onPress === 'function')[0];
  await act(async () => {
    const submitting = submit.props.onPress();
    const deleting = beginAccountDeletion();
    fail(new Error('synthetic network failure'));
    await Promise.all([submitting, deleting]);
  });
  expect(await AsyncStorage.getItem('@aac_feedback_queue')).toBeNull();
});
