import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCENES_KEY, clearCommunicationScenes, loadScenes, makeScenePack, parseScenePack, saveScenes, scenePrintText } from '../services/communication-scenes';
const scene = () => ({ id: 'kitchen', name: 'My kitchen', photo: 'data:image/jpeg;base64,YQ==', points: [{ id: 'cup', label: 'Cup', phrase: 'Where is my cup?', x: 0.4, y: 0.6 }] });
beforeEach(async () => { await clearCommunicationScenes(); jest.clearAllMocks(); });
it('round trips scene names, photos, positions and phrases', async () => {
  const data = [scene()]; await saveScenes(data);
  expect(await loadScenes()).toEqual(data);
  expect(parseScenePack(JSON.stringify(makeScenePack(data))).scenes).toEqual(data);
});
it('rejects external and local file URIs rather than importing paths', () => {
  for (const photo of ['https://example.com/a.jpg', 'file:///private/path', '../tiles/', 'data:text/html;base64,YQ==']) {
    expect(() => makeScenePack([{ ...scene(), photo }])).toThrow();
  }
});
it('rejects out of range coordinates, duplicate point IDs and oversized content', () => {
  expect(() => makeScenePack([{ ...scene(), points: [{ ...scene().points[0], x: -1 }] }])).toThrow();
  expect(() => makeScenePack([{ ...scene(), points: [scene().points[0], scene().points[0]] }])).toThrow();
  expect(() => makeScenePack([{ ...scene(), name: 'a'.repeat(61) }])).toThrow();
  expect(() => parseScenePack(' '.repeat(1900001))).toThrow();
});
it('rejects duplicate scenes and unsupported schema versions', () => {
  expect(() => makeScenePack([scene(), scene()])).toThrow();
  expect(() => parseScenePack(JSON.stringify({ format: 'voice-scenes', version: 2, scenes: [] }))).toThrow();
});
it('does not overwrite corrupt saved data during load', async () => {
  await AsyncStorage.setItem(SCENES_KEY, '{broken');
  await expect(loadScenes()).rejects.toThrow();
  expect(await AsyncStorage.getItem(SCENES_KEY)).toBe('{broken');
});
it('deletion cancels queued saves and does not resurrect photos', async () => {
  const pending = saveScenes([scene()]);
  const cleared = clearCommunicationScenes();
  await expect(pending).rejects.toThrow('cancelled');
  await cleared;
  expect(await loadScenes()).toEqual([]);
});
it('printable text companion contains only scene names and phrases', () => {
  const text = scenePrintText([scene()]);
  expect(text).toBe('My kitchen\n1. Cup: Where is my cup?');
  expect(text).not.toContain('base64');
});
it('escapes scene and phrase markup in printable photo companion', () => {
  const { scenePrintHtml } = require('../services/communication-scenes');
  const data = scene(); data.name = '<script>alert(1)</script>'; data.points[0].phrase = '<img onerror="bad">';
  const html = scenePrintHtml([data]);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img onerror');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('data:image/jpeg;base64,YQ==');
  expect(html).toContain('left:40%;top:60%');
});
it('rejects a stale mounted screen save begun after deletion', async () => {
  const { getScenesGeneration } = require('../services/communication-scenes');
  const oldGeneration = getScenesGeneration();
  await saveScenes([scene()], oldGeneration);
  await clearCommunicationScenes();
  await expect(saveScenes([scene()], oldGeneration)).rejects.toThrow('cancelled');
  expect(await loadScenes()).toEqual([]);
});
it('notifies mounted subscribers immediately on deletion and supports unsubscribe', async () => {
  const { subscribeScenesDeletion, getScenesGeneration } = require('../services/communication-scenes');
  const listener = jest.fn();
  const off = subscribeScenesDeletion(listener);
  const before = getScenesGeneration();
  const pending = clearCommunicationScenes();
  expect(listener).toHaveBeenCalledWith(before + 1);
  await pending; off(); await clearCommunicationScenes();
  expect(listener).toHaveBeenCalledTimes(1);
});
