// src/services/improvedModelLoader.js
// Re-exports from localPredictor for backward compatibility.
// The actual model loading and prediction logic lives in localPredictor.js.

export {
  ensureImprovedModelLoaded,
  ensureImprovedModelLoaded as loadImprovedModel,
  predictTopKWordsWithImprovedModel,
  predictPersonalized,
} from './localPredictor';
