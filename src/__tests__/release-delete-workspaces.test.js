import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import { saveScenes, clearCommunicationScenes, SCENES_KEY } from '../services/communication-scenes';
import { parkConversationDraft, deleteConversationDraft, clearConversationWorkspace, queueWorkspaceReturn, consumeWorkspaceReturn, CONVERSATION_KEY } from '../services/conversation-workspace';
import { createPrivateExportFile, clearPrivateExports } from '../services/privateExportCache';
import { saveSentenceDraft, takeSentenceDraftAfterFontChange, DRAFT_KEY } from '../services/sentenceDraft';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///synthetic-cache/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const scene = [{ id: 'synthetic-scene', name: 'Synthetic kitchen', photo: 'data:image/jpeg;base64,YQ==', points: [] }];
const pendingResolutions = [];
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  pendingResolutions.push(resolve);
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const originalSet = AsyncStorage.setItem.getMockImplementation();
const originalGet = AsyncStorage.getItem.getMockImplementation();
beforeEach(async () => {
  resumeAccountDataSync();
  AsyncStorage.setItem.mockImplementation(originalSet);
  AsyncStorage.getItem.mockImplementation(originalGet);
  FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
  await clearCommunicationScenes();
  await clearConversationWorkspace();
  await clearPrivateExports();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(async () => {
  // A failed assertion must not strand a writer and stall subsequent tests.
  pendingResolutions.splice(0).forEach(resolve => resolve());
  await flush();
});

test('fresh scenes, parked drafts, font drafts and export files cannot be recreated while deletion is paused', async () => {
  await beginAccountDeletion();
  const writer = jest.fn(async () => {});
  await expect(saveScenes(scene)).rejects.toThrow('cancelled');
  await expect(parkConversationDraft('synthetic late message')).rejects.toThrow('cancelled');
  await deleteConversationDraft('stale');
  queueWorkspaceReturn('synthetic late message');
  await saveSentenceDraft(['synthetic', 'late'], 'home');
  await expect(createPrivateExportFile('json', writer)).rejects.toThrow('cancelled');
  expect(consumeWorkspaceReturn()).toBeNull();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
  expect(writer).not.toHaveBeenCalled();
  // Cleanup remains available, including after a failed Auth deletion.
  await clearCommunicationScenes();
  await clearConversationWorkspace();
  await clearPrivateExports();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///synthetic-cache/voice-exports/', { idempotent: true });
  for (const key of [SCENES_KEY, CONVERSATION_KEY, DRAFT_KEY]) expect(await AsyncStorage.getItem(key)).toBeNull();
});

test.each([
  { name: 'scene', key: SCENES_KEY, save: () => saveScenes(scene), cancels: true },
  { name: 'parked draft', key: CONVERSATION_KEY, save: () => parkConversationDraft('synthetic pending message'), cancels: true },
  { name: 'font draft', key: DRAFT_KEY, save: () => saveSentenceDraft(['synthetic'], 'home'), cancels: false },
])('deletion drains the actual $name storage write before the purge', async ({ key, save, cancels }) => {
  const write = deferred();
  AsyncStorage.setItem.mockImplementationOnce((writtenKey, value) => write.promise.then(() => originalSet(writtenKey, value)));
  const saving = save();
  const outcome = saving.then(() => 'saved', () => 'cancelled');
  await flush();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  write.resolve();
  await deleting;
  expect(await outcome).toBe(cancels ? 'cancelled' : 'saved');
  await AsyncStorage.multiRemove([key]);
  expect(await AsyncStorage.getItem(key)).toBeNull();
});

test('an in-flight export writer is drained and its cancelled output is removed', async () => {
  const write = deferred();
  let uri;
  const exporting = createPrivateExportFile('json', async destination => { uri = destination; await write.promise; });
  const cancelled = expect(exporting).rejects.toThrow('cancelled');
  await flush();
  expect(uri).toMatch(/^file:\/\/\/synthetic-cache\/voice-exports\/export-/);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  write.resolve();
  await Promise.all([cancelled, deleting]);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri, { idempotent: true });
});

test('an export awaiting filesystem metadata cannot start its writer after pause and resume', async () => {
  const info = deferred();
  FileSystem.getInfoAsync.mockReturnValueOnce(info.promise);
  const writer = jest.fn(async () => {});
  const exporting = createPrivateExportFile('json', writer);
  const cancelled = expect(exporting).rejects.toThrow('cancelled');
  await flush();
  const deleting = beginAccountDeletion();
  resumeAccountDataSync();
  info.resolve({ exists: false });
  await Promise.all([cancelled, deleting]);
  expect(writer).not.toHaveBeenCalled();
  expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
});

test('a late font-change read is consumed but cannot restore the deleted sentence', async () => {
  const read = deferred();
  AsyncStorage.getItem.mockReturnValueOnce(read.promise);
  const restoring = takeSentenceDraftAfterFontChange({ now: 2000, fontScale: 1.5 });
  const deleting = beginAccountDeletion();
  read.resolve(JSON.stringify({ words: ['synthetic', 'old'], pageId: 'home', savedAt: 1000, fontScale: 1 }));
  await deleting;
  expect(await restoring).toBeNull();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith(DRAFT_KEY);
});

test('intentional saves work again after a new session resumes account data', async () => {
  await beginAccountDeletion();
  resumeAccountDataSync();
  await saveScenes(scene);
  await parkConversationDraft('synthetic new message');
  await saveSentenceDraft(['synthetic', 'new'], 'home');
  const writer = jest.fn(async () => {});
  await createPrivateExportFile('json', writer);
  for (const key of [SCENES_KEY, CONVERSATION_KEY, DRAFT_KEY]) expect(await AsyncStorage.getItem(key)).not.toBeNull();
  expect(writer).toHaveBeenCalledTimes(1);
});
