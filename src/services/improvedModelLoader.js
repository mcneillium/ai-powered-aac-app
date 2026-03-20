// src/services/improvedModelLoader.js
import { ensureLocalModelLoaded, predictTopKLocal } from './localPredictor';

let _initialized = false;

export async function ensureImprovedModelLoaded() {
  if (_initialized) return;
  await ensureLocalModelLoaded();
  _initialized = true;
}

// Alias used by App.js for non-blocking background load
export const loadImprovedModel = ensureImprovedModelLoaded;

// sentence: string, k: number
export async function predictTopKWordsWithImprovedModel(sentence, k = 5) {
  await ensureImprovedModelLoaded();
  const tokens = String(sentence || '').toLowerCase().split(' ').filter(Boolean);
  return predictTopKLocal(tokens, k);
}
