import * as FS from 'expo-file-system/legacy';
import { createPrivateExportFile, clearPrivateExports, cleanupExpiredExports } from '../services/privateExportCache';
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', getInfoAsync: jest.fn(), readDirectoryAsync: jest.fn(),
  makeDirectoryAsync: jest.fn().mockResolvedValue(), deleteAsync: jest.fn().mockResolvedValue(),
}));
beforeEach(async () => {
  await clearPrivateExports(); jest.clearAllMocks();
  FS.getInfoAsync.mockResolvedValue({ exists: false });
});
it('retains exports for receiving apps and deletes the isolated directory on personal deletion', async () => {
  const writer = jest.fn().mockResolvedValue();
  const path = await createPrivateExportFile('json', writer);
  expect(path).toMatch(/^file:\/\/\/cache\/voice-exports\/export-.*\.json$/);
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  await clearPrivateExports();
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:///cache/voice-exports/', { idempotent: true });
});
it('deletion drains an in-flight write and cancels its result', async () => {
  let release; let began;
  const started = new Promise(resolve => { began = resolve; });
  const pending = createPrivateExportFile('pdf', () => { began(); return new Promise(resolve => { release = resolve; }); });
  await started;
  const deletion = clearPrivateExports();
  const rejected = expect(pending).rejects.toThrow('cancelled');
  release(); await rejected; await deletion;
  expect(FS.deleteAsync.mock.calls.at(-1)[0]).toBe('file:///cache/voice-exports/');
});
it('age cleanup only removes old regular files with names created by this service', async () => {
  FS.readDirectoryAsync.mockResolvedValue(['export-1-abc.json', 'export-2-abc.pdf', '../private', 'other.json']);
  FS.getInfoAsync.mockImplementation(async path => path.endsWith('voice-exports/')
    ? { exists: true, isDirectory: true }
    : { exists: true, isDirectory: false, modificationTime: path.includes('export-1') ? 1 : Date.now() / 1000 });
  await cleanupExpiredExports();
  expect(FS.deleteAsync).toHaveBeenCalledTimes(1);
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:///cache/voice-exports/export-1-abc.json', { idempotent: true });
});
