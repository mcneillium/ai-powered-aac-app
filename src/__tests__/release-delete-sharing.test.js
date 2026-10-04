import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { beginAccountDeletion, resumeAccountDataSync } from '../services/accountDeletionBarrier';
import { shareScenePdf, shareSceneBackup } from '../services/communication-transfer';
import { sharePortableBoard, createPortableBoard } from '../services/portable-board-files';

jest.mock('../../firebaseConfig', () => ({ auth: null, db: null }));
jest.mock('../services/customVocabStore', () => ({ loadCustomVocab: jest.fn(async () => []), getCustomVocab: () => [], addCustomVocabItem: jest.fn() }));
jest.mock('../services/tilePhotoStore', () => ({ loadTilePhotos: jest.fn(async () => {}), getTilePhoto: () => null, saveTilePhoto: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///synthetic-cache/',
  getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false })),
  deleteAsync: jest.fn(async () => {}), copyAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
}));
jest.mock('../services/privateExportCache', () => ({ createPrivateExportFile: jest.fn(async (extension, writer) => { const uri = `file:///synthetic-cache/voice-exports/test.${extension}`; await writer(uri); return uri; }) }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///synthetic-cache/staging.pdf' })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const board = { format: 'voice-portable-board', version: 1, personalWords: [{ word: 'synthetic word', category: 'noun' }] };
const pendingResolutions = [];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); pendingResolutions.push(resolve); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
beforeEach(() => {
  resumeAccountDataSync();
  jest.clearAllMocks();
  Sharing.isAvailableAsync.mockResolvedValue(true);
  Print.printToFileAsync.mockResolvedValue({ uri: 'file:///synthetic-cache/staging.pdf' });
});
afterEach(async () => { pendingResolutions.splice(0).forEach(resolve => resolve()); await flush(); });

const pdfShares = [
  { name: 'scene PDF', share: () => shareScenePdf([]) },
  { name: 'portable PDF', share: () => sharePortableBoard(board, true) },
];

test.each(pdfShares)('a delayed $name Print response is drained, cleaned up, and never copied or shared after deletion', async ({ share }) => {
  const print = deferred();
  Print.printToFileAsync.mockReturnValueOnce(print.promise);
  const sharing = share();
  const cancelled = expect(sharing).rejects.toThrow('cancelled');
  await flush();
  expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
  let drained = false;
  const deleting = beginAccountDeletion().then(() => { drained = true; });
  await flush();
  expect(drained).toBe(false);
  print.resolve({ uri: 'file:///synthetic-cache/staging.pdf' });
  await Promise.all([cancelled, deleting]);
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///synthetic-cache/staging.pdf', { idempotent: true });
});

test('paused export and share entry points create no files and never open Print or the share sheet', async () => {
  await beginAccountDeletion();
  for (const share of [() => shareSceneBackup([]), () => shareScenePdf([]), () => sharePortableBoard(board), () => sharePortableBoard(board, true), () => createPortableBoard()]) {
    await expect(share()).rejects.toThrow('cancelled');
  }
  expect(Print.printToFileAsync).not.toHaveBeenCalled();
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test.each([
  { name: 'scene backup', share: () => shareSceneBackup([]) },
  { name: 'portable backup', share: () => sharePortableBoard(board) },
])('$name awaiting sharing availability cannot open the chooser after deletion', async ({ share }) => {
  const available = deferred();
  Sharing.isAvailableAsync.mockReturnValueOnce(available.promise);
  const sharing = share();
  const cancelled = expect(sharing).rejects.toThrow('cancelled');
  await flush();
  const deleting = beginAccountDeletion();
  available.resolve(true);
  await Promise.all([cancelled, deleting]);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('a portable board prepared before a pause cannot be shared in a resumed session', async () => {
  const prepared = await createPortableBoard();
  await beginAccountDeletion();
  resumeAccountDataSync();
  await expect(sharePortableBoard(prepared.board)).rejects.toThrow('cancelled');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
