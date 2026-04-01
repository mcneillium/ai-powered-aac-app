import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Load model.json and weights from your assets folder
const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeights = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
// Load the tokenizer JSON file
const tokenizer = require('../../assets/tf_model/word_prediction_tfjs/tokenizer.json');

// Pre-compute reverse tokenizer once at module level
let _indexToWord = null;
function getIndexToWord() {
  if (!_indexToWord) {
    _indexToWord = Object.fromEntries(
      Object.entries(tokenizer).map(([word, idx]) => [idx, word])
    );
  }
  return _indexToWord;
}

// Model readiness promise — consumers can await this instead of polling
let _modelReadyResolve = null;
export const modelReady = new Promise(resolve => { _modelReadyResolve = resolve; });

/**
 * Loads the improved model and tokenizer, and stores them globally.
 */
export async function loadImprovedModel() {
  await tf.ready();
  try {
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));

    // Warm up with a dummy prediction to eliminate first-inference latency
    const dummy = tf.tensor2d([[1, 2, 3, 4]], [1, 4], 'int32');
    model.predict(dummy);
    dummy.dispose();

    // Store globally for use in prediction functions
    global.betterWordPredictionModel = model;
    global.tokenizer = tokenizer;

    // Signal readiness
    if (_modelReadyResolve) _modelReadyResolve(true);

    return model;
  } catch (error) {
    console.error('Error loading improved model:', error);
    if (_modelReadyResolve) _modelReadyResolve(false);
    throw error;
  }
}

/**
 * Predicts the top K words using the improved model with temperature sampling.
 * Uses pre-computed reverse tokenizer for O(1) lookups instead of rebuilding each call.
 */
export async function predictTopKWordsWithImprovedModel(
  model,
  tok,
  sentence,
  temperature = 1.0,
  sequenceLength = 4,
  topK = 4
) {
  const tokens = sentence.toLowerCase().split(' ');
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) {
    inputTokens.unshift('0');
  }
  const inputIndices = inputTokens.map(token => tok[token] || 0);
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], 'int32');

  const logitsTensor = model.predict(inputTensor);
  const logits = Array.from(logitsTensor.dataSync());

  // Dispose tensors immediately to free memory
  inputTensor.dispose();
  logitsTensor.dispose();

  // Temperature scaling + softmax
  const scaledLogits = logits.map(logit => logit / temperature);
  const maxLogit = Math.max(...scaledLogits);
  const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit)); // numerical stability
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expVal => expVal / sumExp);

  // Get top K indices by probability
  const probIndices = probs.map((prob, index) => ({ index, prob }));
  const sorted = probIndices.sort((a, b) => b.prob - a.prob);
  const topKIndices = sorted.slice(0, topK).map(item => item.index);

  const idxToWord = getIndexToWord();
  return topKIndices
    .map(idx => idxToWord[idx])
    .filter(word => word && word !== '[UNKNOWN]');
}

/**
 * Predicts the next word using the improved model.
 */
export async function predictNextWordWithImprovedModel(model, tok, sentence, temperature = 1.0, sequenceLength = 4) {
  const results = await predictTopKWordsWithImprovedModel(model, tok, sentence, temperature, sequenceLength, 1);
  return results[0] || '[UNKNOWN]';
}
