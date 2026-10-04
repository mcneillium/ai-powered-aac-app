import AsyncStorage from '@react-native-async-storage/async-storage';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import { loadAIProfile, recordWordSelection, flushAIProfile, hasLearnedData, resetAIProfile } from '../services/aiProfileStore';
import { savePersonalData, personalKey } from '../services/prediction/personalStore';
import { initPrediction, setLearningEnabled, learnFromSpoken, getLearningStats, resetLearning } from '../services/suggestionEngine';

beforeEach(async () => {
  resumeAccountDataSync();
  await AsyncStorage.clear();
  await resetAIProfile();
  await resetLearning();
  await AsyncStorage.clear();
});
afterEach(() => resumeAccountDataSync());

test('learning actions after account purge cannot recreate profile or prediction data', async () => {
  await initPrediction();
  setLearningEnabled(true);
  await beginAccountDeletion();
  await resetAIProfile();
  await resetLearning();
  await AsyncStorage.clear();
  for (let i = 0; i < 12; i++) await recordWordSelection('synthetic');
  learnFromSpoken(['synthetic', 'snack']);
  await flushAIProfile();
  expect(await savePersonalData('default', { synthetic: true })).toBe(false);
  expect(hasLearnedData()).toBe(false);
  expect(getLearningStats().sentences).toBe(0);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  resumeAccountDataSync();
  await recordWordSelection('synthetic');
  await flushAIProfile();
  expect(hasLearnedData()).toBe(true);
});

test('account deletion waits for an already-started learned data write before purging', async () => {
  let finish;
  const actualSet = AsyncStorage.setItem.getMockImplementation();
  const spy = AsyncStorage.setItem.mockImplementationOnce((key, value) => new Promise(resolve => {
    finish = async () => { await actualSet(key, value); resolve(); };
  }));
  const writing = savePersonalData('default', { synthetic: true });
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  await finish(); await writing; await deleting;
  await AsyncStorage.removeItem(personalKey('default'));
  expect(await AsyncStorage.getItem(personalKey('default'))).toBeNull();
  spy.mockImplementation(actualSet);
});

test('a delayed legacy profile load does not restore old content after account deletion', async () => {
  let finish;
  AsyncStorage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const loading = loadAIProfile();
  await beginAccountDeletion();
  await resetAIProfile();
  finish(JSON.stringify({ version: 1, totalWordSelections: 99, bigrams: {} }));
  await loading;
  expect(hasLearnedData()).toBe(false);
});
