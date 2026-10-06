import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { MAX_PACK_CHARS, makeScenePack, parseScenePack, scenePrintHtml } from './communication-scenes';
import { createPrivateExportFile } from './privateExportCache';

async function shareFile(uri, options) {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, options);
}
export async function shareSceneBackup(scenes) {
  const text = JSON.stringify(makeScenePack(scenes));
  const uri = await createPrivateExportFile('json', (path) => FileSystem.writeAsStringAsync(path, text));
  await shareFile(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save or share your photo scenes' });
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
export async function shareScenePdf(scenes) {
  let uri;
  try {
    const exported = await createPrivateExportFile('pdf', async (path) => {
      const result = await Print.printToFileAsync({ html: scenePrintHtml(scenes) });
      uri = result.uri;
      await FileSystem.copyAsync({ from: uri, to: path });
    });
    await shareFile(exported, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or print your scene companion' });
  } finally {
    if (uri && FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
