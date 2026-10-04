import { Alert } from 'react-native';
import { deleteUser } from 'firebase/auth';
import { remove } from 'firebase/database';
import { auth, db } from '../../firebaseConfig';
import { deleteLocalPersonalData } from '../services/localData';
import { confirmDeleteAccount } from '../services/accountActions';
import { resumeAccountDataSync, isAccountDeletionPaused, trackAccountDataOperation } from '../services/accountDeletionBarrier';

jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'synthetic-delete-user' } }, db: {} }));
jest.mock('firebase/auth', () => ({ deleteUser: jest.fn(), signOut: jest.fn() }));
jest.mock('firebase/database', () => ({ ref: jest.fn((_db, path) => path), remove: jest.fn() }));
jest.mock('../services/localData', () => ({ deleteLocalPersonalData: jest.fn() }));

let alert;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const startDelete = () => {
  confirmDeleteAccount();
  return alert.mock.calls[0][2].find(button => button.style === 'destructive').onPress();
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
  resumeAccountDataSync();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  remove.mockResolvedValue(undefined);
  deleteUser.mockResolvedValue(undefined);
  deleteLocalPersonalData.mockResolvedValue(undefined);
});
afterEach(() => alert.mockRestore());

test('removes feedback and every synced root, then local data, then Auth', async () => {
  const order = [];
  remove.mockImplementation(async path => { order.push(path); });
  deleteLocalPersonalData.mockImplementation(async () => { order.push('local'); });
  deleteUser.mockImplementation(async () => { order.push('auth'); });
  await startDelete();
  expect(order).toEqual([
    'users/synthetic-delete-user', 'userSettings/synthetic-delete-user',
    'userLogs/synthetic-delete-user', 'userSync/synthetic-delete-user',
    'customVocab/synthetic-delete-user', 'vocabRequests/synthetic-delete-user',
    'feedback/synthetic-delete-user', 'local', 'auth',
  ]);
  expect(deleteLocalPersonalData).toHaveBeenCalledWith({ includeSettings: true });
  expect(alert).toHaveBeenLastCalledWith('Account Deleted', expect.any(String));
});

test('a failed remove waits for the other removes, preserves Auth, and supports retry', async () => {
  const slow = deferred();
  remove.mockImplementation(path => path.startsWith('feedback/') ? Promise.reject(new Error('synthetic failure')) : path.startsWith('users/') ? slow.promise : Promise.resolve());
  const deletion = startDelete();
  await flush();
  expect(remove).toHaveBeenCalledTimes(7);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(deleteUser).not.toHaveBeenCalled();
  slow.resolve();
  await deletion;
  expect(deleteLocalPersonalData).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
  expect(isAccountDeletionPaused()).toBe(true);
  expect(alert).toHaveBeenLastCalledWith('Deletion Incomplete', expect.stringContaining('Some data may already'));
  remove.mockResolvedValue(undefined);
  alert.mockClear();
  await startDelete();
  expect(deleteUser).toHaveBeenCalledTimes(1);
});

test('a local deletion failure preserves Auth and does not claim success', async () => {
  deleteLocalPersonalData.mockRejectedValue(new Error('synthetic storage failure'));
  await startDelete();
  expect(deleteUser).not.toHaveBeenCalled();
  expect(alert).toHaveBeenLastCalledWith('Deletion Incomplete', expect.any(String));
});

test('missing cloud database preserves local data and Auth', async () => {
  const configured = db;
  const config = require('../../firebaseConfig');
  config.db = null;
  try {
    await startDelete();
    expect(remove).not.toHaveBeenCalled();
    expect(deleteLocalPersonalData).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  } finally { config.db = configured; }
});

test('drains earlier writes before removing data and ignores duplicate deletion taps', async () => {
  const pending = deferred();
  trackAccountDataOperation(pending.promise);
  const deleting = startDelete();
  const duplicate = alert.mock.calls[0][2].find(button => button.style === 'destructive').onPress();
  await duplicate;
  await flush();
  expect(remove).not.toHaveBeenCalled();
  pending.resolve();
  await deleting;
  expect(remove).toHaveBeenCalledTimes(7);
  expect(deleteUser).toHaveBeenCalledTimes(1);
});

test('recent-login failure keeps re-authentication instructions and a truthful partial outcome', async () => {
  deleteUser.mockRejectedValue(Object.assign(new Error('synthetic expired login'), { code: 'auth/requires-recent-login' }));
  await startDelete();
  expect(deleteUser).toHaveBeenCalledWith(auth.currentUser);
  expect(alert).toHaveBeenLastCalledWith('Re-authentication Required', expect.stringContaining('log out and log back in'));
});
