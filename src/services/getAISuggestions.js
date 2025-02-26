export async function getAISuggestions(currentSentence) {
  if (!currentSentence.trim()) return [];
  console.log(`🚀 Fetching AI suggestions for: "${currentSentence}"`);

  let attempts = 0;
  const maxAttempts = 10;
  while (!global.modelLoaded && attempts < maxAttempts) {
    console.warn("⏳ Model not loaded yet. Waiting 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!global.modelLoaded) {
    console.error("❌ Model still not loaded after waiting.");
    return [];
  }

  if (typeof global.predictNextWord !== "function") {
    console.error("❌ predictNextWord is not defined!");
    return [];
  }

  try {
    const aiSuggestions = await global.predictNextWord(currentSentence);
    return aiSuggestions;
  } catch (error) {
    console.error("❌ Error during prediction:", error);
    return [];
  }
}
