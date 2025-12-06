// src/services/improvedModelLoader.js
import { ensureLocalModelLoaded, predictTopKLocal } from './localPredictor';

let _initialized = false;

export async function ensureImprovedModelLoaded() {
  if (_initialized) return;
  await ensureLocalModelLoaded();
  _initialized = true;
}

// tokens: string[], k: number
export async function predictTopKWordsWithImprovedModel(tokens, k = 5) {
  await ensureImprovedModelLoaded();
  return predictTopKLocal(tokens, k);
}
