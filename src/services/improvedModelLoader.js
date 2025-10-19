// src/services/improvedModelLoader.js
// Legacy shim — forward everything to localPredictor so old imports keep working.

export * from './localPredictor';
export { ensureImprovedModelLoaded as loadImprovedModel } from './localPredictor';
