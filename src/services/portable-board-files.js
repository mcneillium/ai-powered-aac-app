import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import { createPrivateExportFile } from './privateExportCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';
import { corePages } from '../data/coreVocabulary';
import { symbolFor } from '../data/symbols';
import { loadCustomVocab, getCustomVocab, addCustomVocabItem } from './customVocabStore';
import { loadTilePhotos, getTilePhoto, saveTilePhoto } from './tilePhotoStore';
import { PORTABLE_FORMAT, MAX_FILE_BYTES, MAX_ITEMS, MAX_PHOTO_BASE64, safePhoto, parsePortableBoard, previewPortableImport, printableBoardHTML } from './portable-board-format';

let busyImport = false;
let importGeneration = 0;
let activeImport = null;
const resetListeners = new Set();
const exportGenerations = new WeakMap();
export function subscribePortableReset(listener) { resetListeners.add(listener); return () => resetListeners.delete(listener); }
export async function cancelAndDrainPortableImport() {
  importGeneration += 1;
  resetListeners.forEach((listener) => listener());
  if (activeImport) await activeImport.catch(() => {});
}
function checkGeneration(generation) {
  if (generation !== importGeneration) throw new Error('Import cancelled because personal data is being cleared.');
}
const coreLabels = () => Object.values(corePages).flatMap((page) => page.buttons.map((button) => button.label));
export function importWillSyncWords() { return !!(auth?.currentUser && !auth.currentUser.isAnonymous); }
function cacheFile(extension) {
  if (!FileSystem.cacheDirectory) throw new Error('File export is available in the installed mobile app.');
  return `${FileSystem.cacheDirectory}voice-vocabulary-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}
async function removeTemp(uri) {
  const root = FileSystem.cacheDirectory;
  if (!root || !uri?.startsWith(root)) return;
  const tail = uri.slice(root.length);
  if (!tail || tail.split('/').some((part) => !part || part === '.' || part === '..' || /[%\\]/.test(part))) return;
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (info?.exists && info.isDirectory === false) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function createPortableBoard({ includePhotos = false, columns = 3 } = {}) {
  const generation = importGeneration;
  await loadCustomVocab();
  await loadTilePhotos();
  if (getCustomVocab().length > MAX_ITEMS) throw new Error('This export supports up to 250 personal words.');
  checkGeneration(generation);
  const omittedPhotos = [];
  const personalWords = [];
  let totalPhotoLength = 0;
  for (const item of getCustomVocab()) {
    checkGeneration(generation);
    const entry = { word: item.word, category: item.category || 'misc' };
    const uri = includePhotos ? getTilePhoto(item.id) : null;
    if (uri) {
      try {
        // Only read this app's own tiles directory; never resolve arbitrary stored URLs.
        const root = `${FileSystem.documentDirectory}tiles/`;
        if (!FileSystem.documentDirectory || !uri.startsWith(root) || !/^[A-Za-z0-9_.-]+$/.test(uri.slice(root.length)) || ['.', '..'].includes(uri.slice(root.length))) throw new Error('Unsupported photo location');
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size > MAX_PHOTO_BASE64 * 0.75) throw new Error('Photo unavailable or too large');
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const mime = base64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
        entry.photo = safePhoto({ mime, base64 });
        totalPhotoLength += base64.length;
        if (totalPhotoLength > MAX_FILE_BYTES - 1024 * 1024) { delete entry.photo; throw new Error('Combined photo limit'); }
      } catch { omittedPhotos.push(item.word); }
    }
    personalWords.push(entry);
  }
  checkGeneration(generation);
  const result = { board: { format: PORTABLE_FORMAT, version: 1, createdAt: new Date().toISOString(), columns,
    corePages: Object.values(corePages).map((page) => ({ label: page.label, buttons: page.buttons.map((button) => ({ label: button.label, category: button.category, emoji: symbolFor(button), ...(button.navigateTo ? { navigateTo: button.navigateTo } : {}) })) })), personalWords }, omittedPhotos };
  exportGenerations.set(result.board, generation);
  return result;
}

export async function sharePortableBoard(board, pdf = false) {
  const generation = exportGenerations.get(board) ?? importGeneration;
  checkGeneration(generation);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  checkGeneration(generation);
  let uri;
  if (pdf) {
    let printed;
    try {
      printed = (await Print.printToFileAsync({ html: printableBoardHTML(board) })).uri;
      checkGeneration(generation);
      uri = await createPrivateExportFile('pdf', (destination) => FileSystem.copyAsync({ from: printed, to: destination }));
    } finally { await removeTemp(printed); }
  } else {
    const json = JSON.stringify(board, null, 2);
    if (json.length > MAX_FILE_BYTES) throw new Error('The exported file is too large. Try without photos.');
    uri = await createPrivateExportFile('json', (destination) => FileSystem.writeAsStringAsync(destination, json));
  }
  // A chooser closing is not acknowledgment that the receiver read the file.
  // Private export cache retains it for bounded expiry or explicit data deletion.
  checkGeneration(generation);
  await Sharing.shareAsync(uri, { mimeType: pdf ? 'application/pdf' : 'application/json', UTI: pdf ? 'com.adobe.pdf' : 'public.json', dialogTitle: pdf ? 'Save or share printable board' : 'Save or share Voice vocabulary' });
}

export async function pickPortableBoard() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri || !FileSystem.cacheDirectory || !asset.uri.startsWith(FileSystem.cacheDirectory)) throw new Error('Could not make a local copy of this file.');
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size > MAX_FILE_BYTES) throw new Error('Choose a vocabulary file smaller than 20 MB.');
    return parsePortableBoard(await FileSystem.readAsStringAsync(asset.uri));
  } finally { await removeTemp(asset.uri); }
}

export async function previewImport(board) {
  await loadCustomVocab();
  return previewPortableImport(board, getCustomVocab(), coreLabels());
}

async function runPortableImport(board, { allowAccountSync = false } = {}, generation) {
  if (busyImport) throw new Error('An import is already running.');
  if (importWillSyncWords() && !allowAccountSync) throw new Error('Confirm that imported word labels will sync to your signed-in account.');
  busyImport = true;
  const added = [];
  const failedPhotos = [];
  try {
    const safe = parsePortableBoard(JSON.stringify(board));
    const preview = await previewImport(safe);
    checkGeneration(generation);
    for (const item of preview.add) {
      checkGeneration(generation);
      // The existing store uses millisecond IDs. Avoid collisions without
      // modifying or replacing any existing item, even during fast imports.
      while (getCustomVocab().some((word) => word.id === Date.now().toString())) await new Promise((resolve) => setTimeout(resolve, 2));
      checkGeneration(generation);
      if (importWillSyncWords() && !allowAccountSync) throw new Error('Account changed; please review the import again.');
      const saved = await addCustomVocabItem(item.word, item.category, 'portable-import');
      if (!saved) continue;
      added.push(item.word);
      checkGeneration(generation);
      // Legacy store logs persistence failures; verify before claiming success.
      const persisted = JSON.parse(await AsyncStorage.getItem('@aac_custom_vocab') || '[]');
      if (!persisted.some((word) => word.id === saved.id && word.word === saved.word)) throw new Error('A local save could not be verified. Stop and check device storage.');
      checkGeneration(generation);
      if (item.photo) {
        let temp;
        try {
          temp = cacheFile(item.photo.mime === 'image/png' ? 'png' : 'jpg');
          await FileSystem.writeAsStringAsync(temp, item.photo.base64, { encoding: FileSystem.EncodingType.Base64 });
          checkGeneration(generation);
          await saveTilePhoto(saved.id, temp);
        } catch { failedPhotos.push(item.word); } finally { await removeTemp(temp); }
      }
    }
    checkGeneration(generation);
    return { added, skipped: preview.skipped, failedPhotos };
  } catch (error) {
    throw new Error(`${error.message} ${added.length} word(s) were already added; they were not rolled back. Review before retrying.`);
  } finally { busyImport = false; }
}

export function applyPortableImport(board, options = {}) {
  if (busyImport) return Promise.reject(new Error('An import is already running.'));
  const operation = runPortableImport(board, options, importGeneration);
  activeImport = operation;
  operation.finally(() => { if (activeImport === operation) activeImport = null; }).catch(() => {});
  return operation;
}
