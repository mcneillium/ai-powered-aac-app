// Native share sheets do not confirm when the receiving app has finished reading.
// Keep exports in an isolated app-private cache for at most 24h (cleaned on next
// launch/export), or until the user deletes their personal data. Shared copies
// outside Voice remain under the user's/recipient's control.
import * as FileSystem from 'expo-file-system/legacy';
const directory = () => FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}voice-exports/` : null;
const SAFE_NAME = /^export-[0-9]+-[a-z0-9]+\.(json|pdf)$/;
let queue = Promise.resolve();
let generation = 0;
const enqueue = (operation) => {
  const task = queue.catch(() => {}).then(operation);
  queue = task.catch(() => {});
  return task;
};
async function cleanExpired() {
  const dir = directory();
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return;
  for (const name of await FileSystem.readDirectoryAsync(dir)) {
    if (!SAFE_NAME.test(name)) continue;
    const file = await FileSystem.getInfoAsync(`${dir}${name}`);
    if (file.exists && !file.isDirectory && Number.isFinite(file.modificationTime)
      && Date.now() / 1000 - file.modificationTime > 86400) {
      await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
    }
  }
}
export const cleanupExpiredExports = () => enqueue(cleanExpired);
export function createPrivateExportFile(extension, writer) {
  if (!['json', 'pdf'].includes(extension)) return Promise.reject(new Error('Unsupported export format.'));
  const started = generation;
  return enqueue(async () => {
    if (started !== generation) throw new Error('Export cancelled after deletion.');
    const dir = directory();
    if (!dir) throw new Error('Device storage is unavailable.');
    await cleanExpired();
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const uri = `${dir}export-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    try {
      await writer(uri);
      if (started !== generation) throw new Error('Export cancelled after deletion.');
      return uri;
    } catch (error) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      throw error;
    }
  });
}
export function clearPrivateExports() {
  generation += 1;
  return enqueue(async () => {
    const dir = directory();
    if (dir) await FileSystem.deleteAsync(dir, { idempotent: true });
  });
}
