import { predictTopKWordsWithImprovedModel, modelReady } from './improvedModelLoader';

/**
 * Get AI word suggestions for the current sentence.
 * Awaits model readiness via Promise (no polling) with a timeout.
 */
export async function getAISuggestions(currentSentence) {
  if (!currentSentence.trim()) return [];

  // Wait for model to be ready (max 3s), but don't block indefinitely
  const ready = await Promise.race([
    modelReady,
    new Promise(resolve => setTimeout(() => resolve(false), 3000)),
  ]);

  if (!ready || !global.betterWordPredictionModel || !global.tokenizer) {
    return [];
  }

  try {
    return await predictTopKWordsWithImprovedModel(
      global.betterWordPredictionModel,
      global.tokenizer,
      currentSentence,
      1.0,  // temperature
      4,    // sequenceLength
      4     // topK
    );
  } catch (error) {
    console.warn('AI suggestion error:', error.message);
    return [];
  }
}
