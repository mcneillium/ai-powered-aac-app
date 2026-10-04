import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountDeletionPaused, accountDataGeneration, trackAccountDataOperation } from './accountDeletionBarrier';

export const SCENES_KEY = '@voice_communication_scenes_v1';
export const MAX_PACK_CHARS = 1900000;
const validText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const fail = () => { throw new Error('Invalid scene pack. Use a Voice scene export with up to 3 scenes and 12 points per scene.'); };
export function validateScenePack(value) {
  if (!value || value.format !== 'voice-scenes' || value.version !== 1 || !Array.isArray(value.scenes) || value.scenes.length > 3) return fail();
  const ids = new Set();
  return { format: 'voice-scenes', version: 1, scenes: value.scenes.map((scene) => {
    if (!scene || !validText(scene.id, 80) || ids.has(scene.id) || !validText(scene.name, 60) || !Array.isArray(scene.points) || scene.points.length > 12) return fail();
    ids.add(scene.id);
    if (typeof scene.photo !== 'string' || scene.photo.length > 600000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(scene.photo)) return fail();
    const pointIds = new Set();
    return { id: scene.id, name: scene.name.trim(), photo: scene.photo, points: scene.points.map((p) => {
      if (!p || !validText(p.id, 80) || pointIds.has(p.id) || !validText(p.label, 60) || !validText(p.phrase, 300) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return fail();
      pointIds.add(p.id);
      return { id: p.id, label: p.label.trim(), phrase: p.phrase.trim(), x: p.x, y: p.y };
    }) };
  }) };
}
export const makeScenePack = (scenes) => validateScenePack({ format: 'voice-scenes', version: 1, scenes });
export function parseScenePack(text) {
  if (typeof text !== 'string' || text.length > MAX_PACK_CHARS) return fail();
  return validateScenePack(JSON.parse(text));
}
let queue = Promise.resolve();
let epoch = 0;
const deletionListeners = new Set();
export const getScenesGeneration = () => epoch;
export function subscribeScenesDeletion(listener) { deletionListeners.add(listener); return () => deletionListeners.delete(listener); }
export function loadScenes() {
  if (isAccountDeletionPaused()) return Promise.resolve([]);
  return trackAccountDataOperation(readScenes());
}
async function readScenes() {
  const accountGeneration = accountDataGeneration();
  await queue;
  if (isAccountDeletionPaused() || accountGeneration !== accountDataGeneration()) return [];
  const raw = await AsyncStorage.getItem(SCENES_KEY);
  if (isAccountDeletionPaused() || accountGeneration !== accountDataGeneration()) return [];
  return raw ? parseScenePack(raw).scenes : [];
}
export function saveScenes(scenes, expectedGeneration = epoch) {
  if (isAccountDeletionPaused()) return Promise.reject(new Error('Scene save cancelled during account deletion.'));
  const accountGeneration = accountDataGeneration();
  const raw = JSON.stringify(makeScenePack(scenes));
  const started = expectedGeneration;
  const operation = queue.catch(() => {}).then(async () => {
    if (isAccountDeletionPaused() || accountGeneration !== accountDataGeneration() || started !== epoch) throw new Error('Scene save cancelled after deletion.');
    await AsyncStorage.setItem(SCENES_KEY, raw);
    if (isAccountDeletionPaused() || accountGeneration !== accountDataGeneration() || started !== epoch) throw new Error('Scene save cancelled after deletion.');
  });
  queue = operation.catch(() => {});
  return trackAccountDataOperation(operation);
}
export function clearCommunicationScenes() {
  epoch += 1;
  deletionListeners.forEach((listener) => { try { listener(epoch); } catch { /* A subscriber must not block deletion. */ } });
  const operation = queue.catch(() => {}).then(() => AsyncStorage.removeItem(SCENES_KEY));
  queue = operation.catch(() => {});
  return trackAccountDataOperation(operation);
}
// Text companion for printing through another app; no claim of OBF compatibility.
export function scenePrintText(scenes) {
  return makeScenePack(scenes).scenes.map((s) => `${s.name}\n${s.points.map((p, i) => `${i + 1}. ${p.label}: ${p.phrase}`).join('\n')}`).join('\n\n');
}

const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function scenePrintHtml(scenes) {
  const valid = makeScenePack(scenes).scenes;
  const pages = valid.map((scene) => `<section><h1>${htmlEscape(scene.name)}</h1><div class="scene"><img src="${scene.photo}" alt="${htmlEscape(scene.name)}"/>${scene.points.map((p, i) => `<span class="marker" style="left:${p.x * 100}%;top:${p.y * 100}%">${i + 1}</span>`).join('')}</div><ol>${scene.points.map((p) => `<li><strong>${htmlEscape(p.label)}</strong> — ${htmlEscape(p.phrase)}</li>`).join('')}</ol></section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Voice scene companion</title><style>body{font-family:Arial,sans-serif;color:#151d35;padding:24px}section{page-break-after:always}section:last-child{page-break-after:auto}.scene{position:relative;margin:24px;width:90%;height:320px}.scene img{width:100%;height:100%;object-fit:fill}.marker{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border:2px solid #151d35;border-radius:50%;background:white;text-align:center;line-height:28px;font-weight:bold}li{font-size:18px;margin-bottom:12px}</style></head><body>${pages || '<h1>No photo scenes saved</h1>'}</body></html>`;
}
