import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Load model.json and weights from your assets folder
const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeights = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
// Load the tokenizer JSON file
const tokenizer = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

/**
 * Loads the improved model and tokenizer, and stores them globally.
 */
export async function loadImprovedModel() {
  await tf.ready();
  try {
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    console.log("✅ Improved model loaded successfully!");
    // Store globally for use in prediction functions
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
  const tokens = sentence.toLowerCase().split(" ");
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) {
    inputTokens.unshift("0");
  }
  const inputIndices = inputTokens.map(token => tokenizer[token] || 0);
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], "int32");

  const logitsTensor = model.predict(inputTensor);
  const logits = Array.from(logitsTensor.dataSync());

  // Dispose tensors to free memory
  inputTensor.dispose();
  logitsTensor.dispose();

  const scaledLogits = logits.map(logit => logit / temperature);
  const expLogits = scaledLogits.map(Math.exp);
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expVal => expVal / sumExp);
  const predictedIndex = probs.indexOf(Math.max(...probs));

  const indexToWord = buildIndexToWordMap(tokenizer);
  return indexToWord[predictedIndex] || "[UNKNOWN]";
}

// Cache the reverse tokenizer mapping to avoid rebuilding it on every call
let _cachedTokenizer = null;
let _cachedIndexToWord = null;

function buildIndexToWordMap(tokenizer) {
  if (_cachedTokenizer === tokenizer && _cachedIndexToWord) {
    return _cachedIndexToWord;
  }
  _cachedIndexToWord = Object.fromEntries(
    Object.entries(tokenizer).map(([word, idx]) => [idx, word])
  );
  _cachedTokenizer = tokenizer;
  return _cachedIndexToWord;
}

/**
 * Predicts the top K words using the improved model with temperature sampling.
 *
 * @param {tf.LayersModel} model - The loaded improved model.
 * @param {Object} tokenizer - The tokenizer mapping (word -> index).
 * @param {string} sentence - The input sentence.
 * @param {number} temperature - Temperature parameter for sampling (default 1.0).
 * @param {number} sequenceLength - The number of tokens expected by the model.
 * @param {number} topK - Number of top predictions to return (default 4).
 * @returns {Promise<string[]>} - An array of the top K predicted words, sorted by descending probability.
 */
export async function predictTopKWordsWithImprovedModel(
  model,
  tokenizer,
  sentence,
  temperature = 1.5,
  sequenceLength = 4,
  topK = 4
) {
  const tokens = sentence.toLowerCase().split(" ");
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) {
    inputTokens.unshift("0");
  }
  const inputIndices = inputTokens.map(token => tokenizer[token] || 0);
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], "int32");

  const logitsTensor = model.predict(inputTensor);
  const logits = Array.from(logitsTensor.dataSync());

  // Dispose tensors to free memory
  inputTensor.dispose();
  logitsTensor.dispose();

  const scaledLogits = logits.map(logit => logit / temperature);
  const expLogits = scaledLogits.map(Math.exp);
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expVal => expVal / sumExp);

  // Get indices and probabilities sorted in descending order
  const probIndices = probs.map((prob, index) => ({ index, prob }));
  const sorted = probIndices.sort((a, b) => b.prob - a.prob);
  const topKIndices = sorted.slice(0, topK).map(item => item.index);

  const indexToWord = buildIndexToWordMap(tokenizer);
  return topKIndices.map(idx => indexToWord[idx] || "[UNKNOWN]");
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
