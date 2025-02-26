import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Load model and tokenizer
const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeights = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
const tokenizerModule = require('../../assets/tf_model/tokenizer.json');

export async function loadModel() {
  try {
    await tf.ready();
    console.log("✅ TensorFlow.js is ready!");

    // Load the model
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    console.log("✅ Model loaded successfully!");

    // Load tokenizer
    const tokenizer = tokenizerModule;
    console.log("✅ Tokenizer loaded successfully!");

    // Assign globally
    global.modelLoaded = true;
    global.wordPredictionModel = model;
    global.tokenizer = tokenizer;
    global.predictNextWord = predictNextWord;  // Assign function globally

    return { model, tokenizer };
  } catch (error) {
    console.error("❌ Error in loadModel:", error);
    throw error;
  }
}

/**
 * Predicts the next word(s) given an input sentence.
 */
export async function predictNextWord(sentence) {
  if (!global.wordPredictionModel || !global.tokenizer) {
    console.error("❌ Model or tokenizer is not loaded yet!");
    return [];
  }

  console.log("🔍 Predicting next word for:", sentence);

  // Tokenize sentence with correct length
  const inputTokens = tokenizeSentence(sentence, global.tokenizer);
  if (!inputTokens || inputTokens.length !== 4) {
    console.error("❌ Tokenized sentence does not match expected length (4).");
    return [];
  }

  // Convert to tensor and predict
  const inputTensor = tf.tensor2d([inputTokens], [1, 4]);  // Ensure shape [1, 4]
  const prediction = global.wordPredictionModel.predict(inputTensor);

  // Get the predicted index
  const predictedIndex = prediction.argMax(-1).dataSync()[0];

  // Convert predicted index back to a word
  const predictedWord = decodePrediction(predictedIndex, global.tokenizer);
  console.log("✅ Predicted next word:", predictedWord);

  return [predictedWord];
}

/**
 * Converts a sentence into token indices with fixed length for model input.
 */
function tokenizeSentence(sentence, tokenizer) {
  const maxLength = 4; // Model expects input of 4 tokens
  const words = sentence.toLowerCase().split(" ");
  let tokenized = words.map(word => tokenizer[word] || 0); // Convert words to tokens

  // Ensure tokenized array has exactly 'maxLength' elements
  if (tokenized.length < maxLength) {
    tokenized = Array(maxLength - tokenized.length).fill(0).concat(tokenized); // Pad with zeros
  } else if (tokenized.length > maxLength) {
    tokenized = tokenized.slice(-maxLength); // Truncate from the front
  }

  console.log("🔢 Tokenized sentence:", tokenized);
  return tokenized;
}

/**
 * Converts a predicted token index back to a word.
 */
function decodePrediction(index, tokenizer) {
  return Object.keys(tokenizer).find(word => tokenizer[word] === index) || "[UNKNOWN]";
}
