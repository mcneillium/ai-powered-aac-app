import AsyncStorage from '@react-native-async-storage/async-storage';
import { set, get, push } from 'firebase/database';
import { auth } from '../../firebaseConfig';
import * as NetInfo from '@react-native-community/netinfo';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import { loadCustomVocab, addCustomVocabItem, refreshFromFirebase, getCustomVocab } from '../services/customVocabStore';
import { logEvent, syncLogsToFirebase } from '../utils/enhancedLogger';
import { updateLastActivity } from '../utils/syncStatus';

jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'synthetic-sync-user', isAnonymous: false } }, db: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn((_db, path) => path), set: jest.fn(async () => {}), get: jest.fn(async () => ({ exists: () => false })), push: jest.fn(async () => {}), serverTimestamp: () => 'SERVER_TIMESTAMP' }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(), fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }));
jest.mock('../services/tilePhotoStore', () => ({ getTilePhoto: () => null }));

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(async () => {
  resumeAccountDataSync();
  auth.currentUser = { uid: 'synthetic-sync-user', isAnonymous: false };
  get.mockResolvedValue({ exists: () => false });
  set.mockResolvedValue(undefined);
  push.mockResolvedValue(undefined);
  NetInfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  await AsyncStorage.clear();
  await loadCustomVocab({ reload: true });
  jest.clearAllMocks();
});

test('deletion drains the existing non-blocking vocabulary upload and blocks another', async () => {
  const pending = deferred();
  set.mockReturnValueOnce(pending.promise);
  await addCustomVocabItem('synthetic-word');
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  expect(await addCustomVocabItem('second-synthetic-word')).toBeNull();
  expect(set).toHaveBeenCalledTimes(1);
  pending.resolve();
  await deleting;
  await AsyncStorage.multiRemove(['@aac_custom_vocab', '@aac_custom_vocab_deleted']);
  await loadCustomVocab({ reload: true });
  expect(getCustomVocab()).toEqual([]);
  expect(get).not.toHaveBeenCalled();
});

test('a vocabulary read arriving during deletion cannot restore remote words locally', async () => {
  const pending = deferred();
  get.mockReturnValueOnce(pending.promise);
  const refreshing = refreshFromFirebase();
  const deleting = beginAccountDeletion();
  pending.resolve({ exists: () => true, val: () => ({ items: [{ id: 'remote', word: 'synthetic-remote' }] }) });
  await Promise.all([refreshing, deleting]);
  expect(getCustomVocab()).toEqual([]);
  expect(await AsyncStorage.getItem('@aac_custom_vocab')).toBeNull();
});

test('deletion drains a direct log upload, drops its pending local queue and blocks new logs', async () => {
  const pending = deferred();
  push.mockReturnValueOnce(pending.promise);
  const logging = logEvent('synthetic_action');
  await flush();
  expect(push).toHaveBeenCalledTimes(1);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  pending.resolve();
  await Promise.all([logging, deleting]);
  expect(await logEvent('synthetic_late_action')).toBeNull();
  await AsyncStorage.removeItem('userInteractionLog');
  expect(await syncLogsToFirebase()).toBe(false);
  expect(await AsyncStorage.getItem('userInteractionLog')).toBeNull();
  expect(push).toHaveBeenCalledTimes(1);
});

test('log sync awaiting connectivity cannot upload after deletion starts', async () => {
  await AsyncStorage.setItem('userInteractionLog', JSON.stringify([{ action: 'synthetic_queued', timestamp: 1 }]));
  const network = deferred();
  NetInfo.fetch.mockReturnValueOnce(network.promise);
  const syncing = syncLogsToFirebase();
  const deleting = beginAccountDeletion();
  network.resolve({ isConnected: true, isInternetReachable: true });
  await Promise.all([syncing, deleting]);
  expect(push).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
});

test('anonymous activity remains local and deletion prevents further activity writes', async () => {
  auth.currentUser = { uid: 'synthetic-guest', isAnonymous: true };
  await updateLastActivity();
  expect(await AsyncStorage.getItem('lastActivity')).not.toBeNull();
  expect(set).not.toHaveBeenCalled();
  await beginAccountDeletion();
  await AsyncStorage.removeItem('lastActivity');
  await updateLastActivity();
  expect(await AsyncStorage.getItem('lastActivity')).toBeNull();
});
