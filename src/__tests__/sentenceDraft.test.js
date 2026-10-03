/* eslint-env jest */
// Regression (Android 15 emulator): changing the system font size while Voice
// was open erased the sentence being built. The app now reloads in place at
// the new size and the board restores the sentence from this draft.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DRAFT_KEY,
  RESTORE_WINDOW_MS,
  saveSentenceDraft,
  takeSentenceDraftAfterFontChange,
} from '../services/sentenceDraft';

const T0 = 1_700_000_000_000;

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('restores the sentence and page after a font scale change', async () => {
  await saveSentenceDraft(['I', 'want', 'she'], 'people', { now: T0, fontScale: 1.0 });
  const draft = await takeSentenceDraftAfterFontChange({ now: T0 + 5000, fontScale: 1.5 });
  expect(draft).toEqual({ words: ['I', 'want', 'she'], pageId: 'people' });
});

test('an ordinary restart (same font scale) starts empty as before', async () => {
  await saveSentenceDraft(['I', 'want'], 'home', { now: T0, fontScale: 1.3 });
  await expect(takeSentenceDraftAfterFontChange({ now: T0 + 5000, fontScale: 1.3 })).resolves.toBeNull();
});

test('an old draft is not restored', async () => {
  await saveSentenceDraft(['I', 'want'], 'home', { now: T0, fontScale: 1.0 });
  await expect(
    takeSentenceDraftAfterFontChange({ now: T0 + RESTORE_WINDOW_MS + 1, fontScale: 2.0 })
  ).resolves.toBeNull();
});

test('the draft is consumed once', async () => {
  await saveSentenceDraft(['help'], 'home', { now: T0, fontScale: 1.0 });
  await takeSentenceDraftAfterFontChange({ now: T0 + 1000, fontScale: 2.0 });
  await expect(AsyncStorage.getItem(DRAFT_KEY)).resolves.toBeNull();
  await expect(takeSentenceDraftAfterFontChange({ now: T0 + 2000, fontScale: 1.0 })).resolves.toBeNull();
});

test('empty, corrupt or malformed drafts are ignored', async () => {
  await saveSentenceDraft([], 'home', { now: T0, fontScale: 1.0 });
  await expect(takeSentenceDraftAfterFontChange({ now: T0 + 1, fontScale: 2.0 })).resolves.toBeNull();
  await AsyncStorage.setItem(DRAFT_KEY, '{not json');
  await expect(takeSentenceDraftAfterFontChange({ now: T0 + 1, fontScale: 2.0 })).resolves.toBeNull();
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ words: [1, 2], savedAt: T0, fontScale: 1 }));
  await expect(takeSentenceDraftAfterFontChange({ now: T0 + 1, fontScale: 2.0 })).resolves.toBeNull();
});

test('a storage failure never throws into the board', async () => {
  const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await expect(saveSentenceDraft(['hi'], 'home', { now: T0, fontScale: 1 })).resolves.toBeUndefined();
  spy.mockRestore();
});
