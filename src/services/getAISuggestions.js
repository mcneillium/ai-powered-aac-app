import { predictNextWordWithImprovedModel } from './improvedModelLoader';

export async function getAISuggestions(currentSentence) {
  if (!currentSentence.trim()) return [];
  console.log(`🚀 Fetching AI suggestions for: "${currentSentence}"`);

  let attempts = 0;
  const maxAttempts = 10;
  // Wait until the model and tokenizer are loaded (if applicable)
  while ((!global.betterWordPredictionModel || !global.tokenizer) && attempts < maxAttempts) {
    console.warn("⏳ Improved model or tokenizer not loaded yet. Waiting 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!global.betterWordPredictionModel || !global.tokenizer) {
    console.error("❌ Improved model or tokenizer still not loaded after waiting.");
    return [];
  }

  try {
    const suggestion = await predictNextWordWithImprovedModel(
      global.betterWordPredictionModel,
      global.tokenizer,
      currentSentence,
      1.0, // Temperature parameter (adjust as needed)
      4    // Sequence length (must match your training configuration)
    );
    return [suggestion];
  } catch (error) {
    console.error("❌ Error during improved model prediction:", error);
    return [];
  }
}
