import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { MAX_PACK_CHARS, makeScenePack, parseScenePack, scenePrintHtml } from './communication-scenes';
import { createPrivateExportFile } from './privateExportCache';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

function checkAccountGeneration(generation) {
  if (isAccountDeletionPaused() || generation !== accountDataGeneration()) throw new Error('Sharing cancelled during account deletion.');
}


async function shareFile(uri, options, generation) {
  checkAccountGeneration(generation);
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  checkAccountGeneration(generation);
  await Sharing.shareAsync(uri, options);
}
export function shareSceneBackup(scenes) {
  if (isAccountDeletionPaused()) return Promise.reject(new Error('Sharing cancelled during account deletion.'));
  return trackAccountDataOperation(runShareSceneBackup(scenes, accountDataGeneration()));
}

async function runShareSceneBackup(scenes, generation) {
  const text = JSON.stringify(makeScenePack(scenes));
  const uri = await createPrivateExportFile('json', (path) => FileSystem.writeAsStringAsync(path, text));
  await shareFile(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save or share your photo scenes' }, generation);
}
export async function pickSceneBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error('No file selected.');
  let copiedFile = false;
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    copiedFile = info.exists && !info.isDirectory && !!FileSystem.cacheDirectory && asset.uri.startsWith(FileSystem.cacheDirectory) && !asset.uri.endsWith('/') && !asset.uri.split('/').some((part) => part === '..' || part === '.');
    // UTF-8 can contain up to four bytes per character. Limit bytes as well as
    // parsed text so a malicious document cannot cause an unbounded read.
    if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size > MAX_PACK_CHARS * 4) throw new Error('Scene file is too large.');
    return parseScenePack(await FileSystem.readAsStringAsync(asset.uri));
  } finally {
    // Only the picker-created cache copy; never touch an external source file.
    if (copiedFile) await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
  }
}
export function shareScenePdf(scenes) {
  if (isAccountDeletionPaused()) return Promise.reject(new Error('Sharing cancelled during account deletion.'));
  return trackAccountDataOperation(runShareScenePdf(scenes, accountDataGeneration()));
}

async function runShareScenePdf(scenes, generation) {
  let uri;
  try {
    const exported = await createPrivateExportFile('pdf', async (path) => {
      const result = await Print.printToFileAsync({ html: scenePrintHtml(scenes) });
      uri = result.uri;
      checkAccountGeneration(generation);
      await FileSystem.copyAsync({ from: uri, to: path });
    });
    await shareFile(exported, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or print your scene companion' }, generation);
  } finally {
    if (uri && FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
