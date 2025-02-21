import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

let model;
let tokenizer = {};
global.modelLoaded = false; // Global flag to indicate when the model is loaded

export async function loadModel() {
  await tf.ready();
  console.log("TensorFlow.js is ready!");

  try {
    // Load the model asset from the asset registry.
    // Ensure that the relative path here matches your project structure.
    const modelAsset = Asset.fromModule(require('../../assets/tf_model/word_prediction_tfjs/model.json'));
    console.log("Model asset from require:", modelAsset);
    await modelAsset.downloadAsync();
    const modelUri = modelAsset.localUri || modelAsset.uri;
    console.log("Model URI:", modelUri);

    // Load the model using the URI.
    model = await tf.loadLayersModel(modelUri);
    console.log("Model loaded successfully!");

    // Load the tokenizer asset.
    const tokenizerAsset = Asset.fromModule(require('../../assets/tf_model/tokenizer.json'));
    console.log("Tokenizer asset from require:", tokenizerAsset);
    await tokenizerAsset.downloadAsync();
    const tokenizerUri = tokenizerAsset.localUri || tokenizerAsset.uri;
    console.log("Tokenizer URI:", tokenizerUri);

    // Read and parse the tokenizer file.
    const tokenizerJson = await FileSystem.readAsStringAsync(tokenizerUri);
    tokenizer = JSON.parse(tokenizerJson);
    console.log("Tokenizer loaded successfully!");

    global.modelLoaded = true;
    console.log("Global modelLoaded flag set to true.");
  } catch (error) {
    console.error("Error in loadModel:", error);
  }
}

/**
 * Predict the next word(s) given a partial sentence.
 * @param {string} sentence - The input sentence.
 * @returns {string[]} - Array of top predicted words.
 */
export function predictNextWord(sentence) {
  if (!model) {
    console.error("Model not loaded yet.");
    return [];
  }

  // Tokenize the sentence (simple lower-case split by space)
  const words = sentence.toLowerCase().split(" ");
  const tokenized = words.map(word => tokenizer[word] || 0);

  // Create an input tensor from the tokenized array.
  const inputTensor = tf.tensor2d([tokenized], [1, tokenized.length]);

  // Get predictions from the model (assuming softmax output)
  const predictions = model.predict(inputTensor);
  const predictionData = predictions.dataSync();

  // Create a reverse mapping from token indices to words.
  const reverseTokenizer = Object.entries(tokenizer).reduce((obj, [word, index]) => {
    obj[index] = word;
    return obj;
  }, {});

  // Rank predictions by probability and select the top 3.
  const ranked = Array.from(predictionData)
    .map((prob, i) => ({
      word: reverseTokenizer[i] || '',
      probability: prob
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);

  return ranked.map(item => item.word);
}
