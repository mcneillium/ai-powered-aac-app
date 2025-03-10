import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Load model.json and weights from your assets folder
const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeights = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
// Load the tokenizer JSON file
const tokenizer = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

export async function loadImprovedModel() {
  await tf.ready();
  try {
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    console.log("✅ Improved model loaded successfully!");
    // Store the improved model and tokenizer globally for later use
    global.betterWordPredictionModel = model;
    global.tokenizer = tokenizer;
    return model;
  } catch (error) {
    console.error("❌ Error loading improved model:", error);
    throw error;
  }
}

/**
 * Predicts the next word using the improved model with temperature sampling.
 *
 * @param {tf.LayersModel} model - The loaded improved model.
 * @param {Object} tokenizer - The tokenizer mapping (word -> index).
 * @param {string} sentence - The input sentence.
 * @param {number} temperature - Temperature parameter for sampling (default 1.0).
 * @param {number} sequenceLength - The number of tokens expected by the model.
 * @returns {Promise<string>} - The predicted next word.
 */
export async function predictNextWordWithImprovedModel(model, tokenizer, sentence, temperature = 1.0, sequenceLength = 4) {
  // Preprocess the sentence: lower case and split into tokens
  const tokens = sentence.toLowerCase().split(" ");
  // Use only the last `sequenceLength` tokens; pad with "0" if necessary (assuming "0" is padding)
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) {
    inputTokens.unshift("0");
  }
  // Convert tokens to indices using the tokenizer; default to 0 if not found
  const inputIndices = inputTokens.map(token => tokenizer[token] || 0);
  
  // Create a tensor of shape [1, sequenceLength]
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], "int32");
  
  // Run prediction; assume the model outputs logits of shape [1, vocabSize]
  const logitsTensor = model.predict(inputTensor);
  // Get the logits as an array
  const logits = Array.from(logitsTensor.dataSync());
  
  // Apply temperature scaling: new logits = logits / temperature
  const scaledLogits = logits.map(logit => logit / temperature);
  
  // Compute softmax probabilities from scaled logits
  const expLogits = scaledLogits.map(Math.exp);
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expLogit => expLogit / sumExp);
  
  // Sample an index from the probability distribution
  const sampledIndex = sampleFromDistribution(probs);
  
  // Build a reverse mapping from index to word
  const indexToWord = Object.fromEntries(
    Object.entries(tokenizer).map(([word, idx]) => [idx, word])
  );
  
  return indexToWord[sampledIndex] || "[UNKNOWN]";
}

/**
 * Helper function to sample an index from a probability distribution.
 *
 * @param {number[]} probs - Array of probabilities.
 * @returns {number} - The sampled index.
 */
function sampleFromDistribution(probs) {
  const threshold = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (cumulative >= threshold) {
      return i;
    }
  }
  return probs.length - 1; // fallback
}
