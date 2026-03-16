import { predictTopKWordsWithImprovedModel } from './improvedModelLoader';

/**
 * Returns AI-powered word suggestions for the given sentence context.
 * @param {string} currentSentence - The sentence built so far.
 * @returns {Promise<string[]>} Array of suggested next words.
 */
export async function getAISuggestions(currentSentence) {
  if (!currentSentence || !currentSentence.trim()) return [];
  console.log(`🚀 Fetching AI suggestions for: "${currentSentence}"`);

  let attempts = 0;
  const maxAttempts = 10;
  while ((!global.betterWordPredictionModel || !global.tokenizer) && attempts < maxAttempts) {
    console.warn("⏳ Model or tokenizer not loaded yet. Waiting 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!global.betterWordPredictionModel || !global.tokenizer) {
    console.error("❌ Model or tokenizer still not loaded after waiting.");
    return [];
  }

  try {
    // Return the top 4 predictions
    const suggestions = await predictTopKWordsWithImprovedModel(
      global.betterWordPredictionModel,
      global.tokenizer,
      currentSentence,
      1.0,  // temperature
      4,    // sequenceLength
      4     // topK
    );
    return suggestions;
  } catch (error) {
    console.error("❌ Error during improved model prediction:", error);
    return [];
  }
}
