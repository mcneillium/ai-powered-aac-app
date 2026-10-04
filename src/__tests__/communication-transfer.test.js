import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Picker from 'expo-document-picker';
import { shareSceneBackup, pickSceneBackup, shareScenePdf } from '../services/communication-transfer';
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', writeAsStringAsync: jest.fn().mockResolvedValue(), deleteAsync: jest.fn().mockResolvedValue(), getInfoAsync: jest.fn(), readDirectoryAsync: jest.fn().mockResolvedValue([]), makeDirectoryAsync: jest.fn().mockResolvedValue(), copyAsync: jest.fn().mockResolvedValue(), readAsStringAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/print.pdf' }) }));
beforeEach(() => { jest.clearAllMocks(); FS.getInfoAsync.mockResolvedValue({ exists: false }); });
it('retains a private cache file after the Android chooser returns', async () => {
  await shareSceneBackup([]);
  const path = FS.writeAsStringAsync.mock.calls[0][0];
  expect(path).toMatch(/^file:\/\/\/cache\/voice-exports\/export-.*\.json$/);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(path, expect.objectContaining({ mimeType: 'application/json' }));
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
it('retains exported file until age or personal-data cleanup even after sharing error', async () => {
  Sharing.shareAsync.mockRejectedValueOnce(new Error('no target'));
  await expect(shareSceneBackup([])).rejects.toThrow();
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
it('rejects oversized document before reading its contents', async () => {
  Picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/picked.json' }] });
  FS.getInfoAsync.mockResolvedValue({ exists: true, size: 8000000, isDirectory: false });
  await expect(pickSceneBackup()).rejects.toThrow('too large');
  expect(FS.readAsStringAsync).not.toHaveBeenCalled();
});
it('validates the imported pack and never deletes an external source', async () => {
  Picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/document/1' }] });
  FS.getInfoAsync.mockResolvedValue({ exists: true, size: 100, isDirectory: false });
  FS.readAsStringAsync.mockResolvedValue('{"format":"voice-scenes","version":1,"scenes":[]}');
  expect(await pickSceneBackup()).toEqual({ format: 'voice-scenes', version: 1, scenes: [] });
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
it('retains shared PDF while removing the separate print staging file', async () => {
  await shareScenePdf([]);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/voice-exports\/export-.*\.pdf$/), expect.objectContaining({ mimeType: 'application/pdf' }));
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:///cache/print.pdf', { idempotent: true });
});
it('never deletes a directory returned as a picked document', async () => {
  Picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/some-folder' }] });
  FS.getInfoAsync.mockResolvedValue({ exists: true, size: 100, isDirectory: true });
  await expect(pickSceneBackup()).rejects.toThrow();
  expect(FS.deleteAsync).not.toHaveBeenCalled();
});
