import { predictNextWordWithImprovedModel } from './improvedModel';

export async function getAISuggestions(currentSentence) {
  if (!currentSentence.trim()) return [];
  console.log(`🚀 Fetching AI suggestions for: "${currentSentence}"`);

  let attempts = 0;
  const maxAttempts = 10;
  while ((!global.modelLoaded || !global.tokenizer) && attempts < maxAttempts) {
    console.warn("⏳ Model or tokenizer not loaded yet. Waiting 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!global.modelLoaded || !global.tokenizer) {
    console.error("❌ Model/tokenizer still not loaded after waiting.");
    return [];
  }

  try {
    if (global.betterWordPredictionModel) {
      const suggestion = await predictNextWordWithImprovedModel(
        global.betterWordPredictionModel,
        global.tokenizer,
        currentSentence,
        1.0, // temperature (adjust as needed)
        4    // sequence length
      );
      return [suggestion];
    }
    console.error("❌ No improved model available!");
    return [];
  } catch (error) {
    console.error("❌ Error during prediction:", error);
    return [];
  }
}
