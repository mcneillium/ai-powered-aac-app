import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Load model.json, weights, and tokenizer from your assets folder
const modelJson = require('../../assets/tf_model/model.json');
const modelWeights = [require('../../assets/tf_model/group1-shard1of1.bin')];
const tokenizerData = require('../../assets/tf_model/tokenizer.json');

/**
 * Loads the improved model and tokenizer, and stores them globally.
 */
export async function loadImprovedModel() {
  await tf.ready();
  try {
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    console.log("✅ Improved model loaded successfully!");

    const tokenizer = tokenizerData;
    const indexToWord = tokenizer.index_word 
      ? tokenizer.index_word 
      : Object.fromEntries(Object.entries(tokenizer).map(([word, idx]) => [idx, word]));

    global.betterWordPredictionModel = model;
    global.tokenizer = tokenizer;
    global.indexToWord = indexToWord;
    global.predictNextWordWithImprovedModel = predictNextWordWithImprovedModel;

    return { model, tokenizer };
  } catch (error) {
    console.error("❌ Error loading improved model:", error);
    throw error;
  }
}

/**
 * Predicts the next word using the improved model with temperature sampling.
 */
export async function predictNextWordWithImprovedModel(model, tokenizer, sentence, temperature = 1.0, sequenceLength = 4) {
  const tokens = sentence.toLowerCase().split(/\s+/);
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) inputTokens.unshift("0");

  const inputIndices = inputTokens.map(token => tokenizer.word_index?.[token] || tokenizer[token] || 0);
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], "int32");

  const logitsTensor = model.predict(inputTensor);
  const logits = Array.from(logitsTensor.dataSync());
  const scaledLogits = logits.map(logit => logit / temperature);
  const expLogits = scaledLogits.map(Math.exp);
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expVal => expVal / sumExp);

  const predictedIndex = probs.indexOf(Math.max(...probs));
  const indexToWord = global.indexToWord || Object.fromEntries(Object.entries(tokenizer).map(([word, idx]) => [idx, word]));

  return indexToWord[predictedIndex] || "[UNKNOWN]";
}

/**
 * Predicts the top K words using the improved model with temperature sampling.
 */
export async function predictTopKWordsWithImprovedModel(model, tokenizer, sentence, temperature = 1.5, sequenceLength = 4, topK = 4) {
  const tokens = sentence.toLowerCase().split(/\s+/);
  let inputTokens = tokens.slice(-sequenceLength);
  while (inputTokens.length < sequenceLength) inputTokens.unshift("0");

  const inputIndices = inputTokens.map(token => tokenizer.word_index?.[token] || tokenizer[token] || 0);
  const inputTensor = tf.tensor2d([inputIndices], [1, sequenceLength], "int32");

  const logitsTensor = model.predict(inputTensor);
  const logits = Array.from(logitsTensor.dataSync());
  const scaledLogits = logits.map(logit => logit / temperature);
  const expLogits = scaledLogits.map(Math.exp);
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(expVal => expVal / sumExp);

  const probIndices = probs.map((prob, index) => ({ index, prob }));
  const sorted = probIndices.sort((a, b) => b.prob - a.prob);
  const topKIndices = sorted.slice(0, topK).map(item => item.index);

  const indexToWord = global.indexToWord || Object.fromEntries(Object.entries(tokenizer).map(([word, idx]) => [idx, word]));
  return topKIndices.map(idx => indexToWord[idx] || "[UNKNOWN]");
}
