import AsyncStorage from '@react-native-async-storage/async-storage';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import * as favourites from '../services/favouritesStore';
import * as history from '../services/sentenceHistoryStore';
import * as pronunciations from '../services/pronunciationStore';

const stores = [
  {
    name: 'favourites', key: '@aac_favourites', load: favourites.loadFavourites, read: favourites.getFavourites,
    add: () => favourites.addFavourite('synthetic favourite'),
    otherWrites: () => Promise.all([favourites.removeFavourite('stale'), favourites.reorderFavourites([{ id: 'stale', phrase: 'synthetic old favourite' }])]),
    oldData: [{ id: 'stale', phrase: 'synthetic old favourite' }],
  },
  {
    name: 'history', key: '@aac_sentence_history', load: history.loadSentenceHistory, read: history.getSentenceHistory,
    add: () => history.addSentenceToHistory('synthetic history message'),
    otherWrites: () => Promise.all([history.incrementSpeakCount('synthetic history message'), history.clearSentenceHistory()]),
    oldData: [{ text: 'synthetic old history', speakCount: 1 }],
  },
  {
    name: 'pronunciations', key: '@aac_pronunciations', load: pronunciations.loadPronunciations, read: pronunciations.getPronunciations,
    add: () => pronunciations.setPronunciation('Synthetic', 'Sin thetic'),
    otherWrites: () => pronunciations.removePronunciation('stale'),
    oldData: [{ id: 'stale', written: 'Synthetic', spoken: 'Sin thetic' }],
  },
];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const originalSet = AsyncStorage.setItem.getMockImplementation();
const originalGet = AsyncStorage.getItem.getMockImplementation();
beforeEach(async () => {
  resumeAccountDataSync();
  AsyncStorage.setItem.mockImplementation(originalSet);
  AsyncStorage.getItem.mockImplementation(originalGet);
  await AsyncStorage.clear();
  for (const store of stores) await store.load({ reload: true });
  jest.clearAllMocks();
});

test.each(stores)('$name writes stay blocked after the purge while Auth deletion is pending, then resume on a new session', async store => {
  await store.add();
  await beginAccountDeletion();
  await AsyncStorage.multiRemove([store.key]);
  await store.load({ reload: true });
  AsyncStorage.setItem.mockClear();
  await store.add();
  await store.otherWrites();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(store.read()).toEqual([]);
  expect(await AsyncStorage.getItem(store.key)).toBeNull();
  resumeAccountDataSync();
  await store.add();
  expect(store.read()).toHaveLength(1);
  expect(await AsyncStorage.getItem(store.key)).not.toBeNull();
});

test.each(stores)('$name deletion drains an actual storage write before the purge', async store => {
  const write = deferred();
  AsyncStorage.setItem.mockImplementationOnce((key, value) => write.promise.then(() => originalSet(key, value)));
  const adding = store.add();
  await flush();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  write.resolve();
  await Promise.all([adding, deleting]);
  await AsyncStorage.multiRemove([store.key]);
  await store.load({ reload: true });
  expect(store.read()).toEqual([]);
  expect(await AsyncStorage.getItem(store.key)).toBeNull();
});

test.each(stores)('$name delayed load cannot restore old in-memory content after deletion starts', async store => {
  const read = deferred();
  AsyncStorage.getItem.mockReturnValueOnce(read.promise);
  const loading = store.load({ reload: true });
  const deleting = beginAccountDeletion();
  read.resolve(JSON.stringify(store.oldData));
  await Promise.all([loading, deleting]);
  expect(store.read()).toEqual([]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test.each(stores)('$name cancelled load does not back up a late corrupt snapshot after deletion', async store => {
  const read = deferred();
  AsyncStorage.getItem.mockReturnValueOnce(read.promise);
  const loading = store.load({ reload: true });
  const deleting = beginAccountDeletion();
  read.resolve('{synthetic corrupt data');
  await Promise.all([loading, deleting]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(`${store.key}__corrupt`)).toBeNull();
});
