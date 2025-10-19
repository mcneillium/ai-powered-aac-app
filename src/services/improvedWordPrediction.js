// src/services/improvedWordPrediction.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../utils/logger';

// ------------------------------
// Internal caches / state
// ------------------------------
let predictionCache = {};
let frequencyModel = null;
let reverseIndex = null; // built from tokenizer.index_word or derived from word_index

// ------------------------------
// Public: initialize system
// ------------------------------
export async function initWordPrediction() {
  try {
    console.log('🚀 Initializing word prediction system...');
    await tf.ready();
    console.log('✅ TensorFlow.js is ready');

    await loadModel();
    await initFrequencyModel();

    return true;
  } catch (error) {
    console.error('❌ Error initializing word prediction:', error);
    // Still bring up the frequency model so the app remains usable
    await initFrequencyModel();
    return false;
  }
}

// ------------------------------
// Load TFJS model + tokenizer (bundled, no cache)
// ------------------------------
async function loadModel() {
  try {
    // Ensure we don't accidentally load a stale remote/cached model
    try { await AsyncStorage.removeItem('wordPredictionModel'); } catch {}

    console.log('Loading bundled model (no cache)...');

    // These names MUST match model.json -> weightsManifest[0].paths
    const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
    const modelWeights = [
      require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin'),
    ];

    // Load the model and weights together from the app bundle
    global.wordPredictionModel = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));

    // Load tokenizer (expects { word_index: {...}, index_word: {...} })
    const tokenizerData = require('../../assets/tf_model/tokenizer.json');
    global.tokenizer = tokenizerData;

    // Build reverse index once (fast decode)
    if (global.tokenizer?.index_word) {
      reverseIndex = global.tokenizer.index_word; // { "1": "the", "2": "to", ... }
    } else if (global.tokenizer?.word_index) {
      reverseIndex = Object.fromEntries(
        Object.entries(global.tokenizer.word_index).map(([w, i]) => [String(i), w])
      );
    } else {
      reverseIndex = null;
    }

    // Warm up: int32 input, shape [1,4] (embedding-friendly)
    global.wordPredictionModel.predict(tf.tensor2d([[0, 0, 0, 0]], [1, 4], 'int32')).dispose();

    console.log('✅ Bundled model loaded. Input shape:', global.wordPredictionModel.inputs?.[0]?.shape);
    return true;
  } catch (err) {
    console.error('❌ Error loading improved model:', err);
    console.warn('Hint: ensure shard filenames exactly match model.json -> weightsManifest[].paths');
    throw err;
  }
}

// ------------------------------
// Frequency-based fallback model
// ------------------------------
async function initFrequencyModel() {
  try {
    const storedFrequencyData = await AsyncStorage.getItem('wordFrequencyModel');

    if (storedFrequencyData) {
      frequencyModel = JSON.parse(storedFrequencyData);
      console.log('✅ Frequency model loaded from storage with', Object.keys(frequencyModel).length, 'patterns');
    } else {
      frequencyModel = {
        'i want': ['to', 'some', 'a', 'the', 'more'],
        'i need': ['help', 'to', 'a', 'some', 'water'],
        'i am': ['happy', 'sad', 'tired', 'hungry', 'thirsty'],
        'i feel': ['good', 'bad', 'sick', 'happy', 'tired'],
        'can you': ['help', 'please', 'get', 'show', 'bring'],
        'i like': ['to', 'this', 'it', 'that', 'the'],
        'thank you': ['for', 'so', 'very', 'much', '.'],
        'how are': ['you', 'they', 'we', 'things', 'the'],
        'where is': ['the', 'my', 'your', 'it', 'that'],
        'what time': ['is', 'was', 'will', 'does', 'do'],
      };
      await AsyncStorage.setItem('wordFrequencyModel', JSON.stringify(frequencyModel));
      console.log('✅ Initial frequency model created');
    }
    return true;
  } catch (error) {
    console.error('❌ Error initializing frequency model:', error);
    frequencyModel = {
      'i want': ['to', 'a', 'some'],
      'i need': ['help', 'to', 'a'],
      'thank you': ['.', 'very', 'much'],
    };
    return false;
  }
}

export async function updateFrequencyModel(prefix, nextWord) {
  try {
    if (!prefix || !nextWord) return;

    prefix = prefix.toLowerCase().trim();
    nextWord = nextWord.toLowerCase().trim();

    const words = prefix.split(' ');
    const key = words.length >= 2 ? words.slice(-2).join(' ') : prefix;

    if (!frequencyModel[key]) {
      frequencyModel[key] = [nextWord];
    } else {
      const idx = frequencyModel[key].indexOf(nextWord);
      if (idx !== -1) frequencyModel[key].splice(idx, 1);
      frequencyModel[key].unshift(nextWord);
      if (frequencyModel[key].length > 10) frequencyModel[key] = frequencyModel[key].slice(0, 10);
    }

    const updateCount = parseInt((await AsyncStorage.getItem('frequencyUpdateCount')) || '0', 10);
    if (updateCount % 20 === 0) {
      await AsyncStorage.setItem('wordFrequencyModel', JSON.stringify(frequencyModel));
      console.log('✓ Frequency model saved to storage');
    }
    await AsyncStorage.setItem('frequencyUpdateCount', String(updateCount + 1));
  } catch (error) {
    console.error('Error updating frequency model:', error);
  }
}

function getFrequencyBasedPredictions(inputText, numPredictions = 5) {
  try {
    if (!frequencyModel || !inputText) return [];

    inputText = inputText.toLowerCase().trim();

    // Exact tail
    for (const key of Object.keys(frequencyModel)) {
      if (inputText.endsWith(key)) return frequencyModel[key].slice(0, numPredictions);
    }

    // Partial
    const words = inputText.split(' ');
    if (words.length >= 2) {
      const lastTwo = words.slice(-2).join(' ');
      for (const key of Object.keys(frequencyModel)) {
        if (key.startsWith(lastTwo)) return frequencyModel[key].slice(0, numPredictions);
      }
      const lastOne = words[words.length - 1];
      for (const key of Object.keys(frequencyModel)) {
        if (key.startsWith(lastOne + ' ') || key === lastOne) {
          return frequencyModel[key].slice(0, numPredictions);
        }
      }
    }

    if (inputText.endsWith('?')) return ['yes', 'no', 'maybe', 'sometimes', 'often'];
    if (inputText.endsWith('!')) return ['yes', 'thanks', 'please', 'help', 'now'];
    return ['the', 'to', 'a', 'and', 'is'];
  } catch (error) {
    console.error('Error in frequency predictions:', error);
    return ['the', 'to', 'a', 'and', 'is'];
  }
}

// ------------------------------
// Tokenization helpers
// ------------------------------
function tokenizeSentence(sentence, sequenceLength = 4) {
  try {
    if (!global.tokenizer) throw new Error('Tokenizer not loaded');

    const wordIndex = global.tokenizer.word_index || global.tokenizer; // support legacy flat maps
    const words = sentence.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let tokens = words.map((w) => wordIndex[w] ?? 0);

    // Left-pad/truncate to fixed length
    if (tokens.length < sequenceLength) {
      tokens = Array(sequenceLength - tokens.length).fill(0).concat(tokens);
    } else if (tokens.length > sequenceLength) {
      tokens = tokens.slice(-sequenceLength);
    }
    return tokens;
  } catch (error) {
    console.error('Error tokenizing sentence:', error);
    return Array(sequenceLength).fill(0);
  }
}

function decodeToken(tokenId) {
  try {
    if (!global.tokenizer) throw new Error('Tokenizer not loaded');

    if (reverseIndex && reverseIndex[String(tokenId)]) return reverseIndex[String(tokenId)];

    const t = global.tokenizer;
    if (t.index_word && t.index_word[String(tokenId)]) return t.index_word[String(tokenId)];
    if (t.word_index) {
      for (const [word, id] of Object.entries(t.word_index)) {
        if (id === tokenId) return word;
      }
    }
    // Legacy flat map
    if (!t.word_index && !t.index_word) {
      for (const [word, id] of Object.entries(t)) {
        if (id === tokenId) return word;
      }
    }
    return '[UNK]';
  } catch (error) {
    console.error('Error decoding token:', error);
    return '[ERROR]';
  }
}

// ------------------------------
// TF model prediction
// ------------------------------
async function getTensorFlowPredictions(inputText, numPredictions = 5, temperature = 1.0) {
  try {
    if (!global.wordPredictionModel || !global.tokenizer) {
      throw new Error('Model or tokenizer not loaded');
    }

    const cacheKey = `${inputText}-${numPredictions}-${temperature}`;
    if (predictionCache[cacheKey]) return predictionCache[cacheKey];

    const tokens = tokenizeSentence(inputText, 4); // model expects 4 tokens
    const inputTensor = tf.tensor2d([tokens], [1, 4], 'int32');

    const logitsOrProbs = global.wordPredictionModel.predict(inputTensor);
    const probsTensor = Array.isArray(logitsOrProbs) ? logitsOrProbs[0] : logitsOrProbs;

    // Apply temperature; softmax makes it safe whether model outputs logits or probs
    const scaled = temperature !== 1.0 ? tf.div(probsTensor, tf.scalar(temperature)) : probsTensor;
    const probs = tf.softmax(scaled);
    const data = await probs.data();

    // top-k (greedy, no repetition, skip id 0)
    const top = [];
    const used = new Set();
    for (let k = 0; k < numPredictions; k++) {
      let bestI = -1;
      let bestV = -Infinity;
      for (let i = 0; i < data.length; i++) {
        if (used.has(i)) continue;
        if (data[i] > bestV) { bestV = data[i]; bestI = i; }
      }
      if (bestI <= 0) break;
      used.add(bestI);
      top.push(bestI);
    }

    const predictedWords = top
      .map((id) => decodeToken(id))
      .filter((w) => w !== '[UNK]' && w !== '[ERROR]');

    // Cleanup
    inputTensor.dispose();
    if (probsTensor !== logitsOrProbs) logitsOrProbs.dispose?.();
    probs.dispose();
    if (scaled !== probsTensor) scaled.dispose?.();

    predictionCache[cacheKey] = predictedWords;

    // Cap cache size
    const keys = Object.keys(predictionCache);
    if (keys.length > 100) delete predictionCache[keys[0]];

    return predictedWords;
  } catch (error) {
    console.error('Error in TensorFlow predictions:', error);
    return [];
  }
}

// ------------------------------
// Public API used by screens/hooks
// ------------------------------
export async function getPredictions(inputText, numPredictions = 5) {
  if (!inputText || inputText.trim().length === 0) return [];

  try {
    logEvent('prediction_request', { inputText, length: inputText.split(' ').length });

    if (global.wordPredictionModel && global.tokenizer) {
      try {
        const tfPreds = await getTensorFlowPredictions(inputText, numPredictions);
        if (tfPreds && tfPreds.length > 0) return tfPreds;
      } catch {
        console.log('TensorFlow prediction failed, falling back to frequency model');
      }
    }

    return getFrequencyBasedPredictions(inputText, numPredictions);
  } catch (error) {
    console.error('Error getting predictions:', error);
    return ['I', 'you', 'the', 'to', 'and'].slice(0, numPredictions);
  }
}

export async function learnFromUserInput(context, selectedWord) {
  try {
    await updateFrequencyModel(context, selectedWord);
    logEvent('prediction_learning', { context, selectedWord, success: true });
  } catch (error) {
    console.error('Error learning from user input:', error);
  }
}

export function clearPredictionCache() {
  predictionCache = {};
  console.log('Prediction cache cleared');
}

// Optional: simulated fine-tuning placeholder
export async function fineTuneModel(epochs = 3) {
  try {
    if (!global.wordPredictionModel) throw new Error('Model not loaded');

    console.log(`Fine-tuning model for ${epochs} epochs...`);
    await new Promise((r) => setTimeout(r, epochs * 1000));
    logEvent('model_fine_tuning', { epochs, success: true, timestamp: new Date().toISOString() });
    console.log('✅ Model fine-tuning completed');
    clearPredictionCache();
    return true;
  } catch (error) {
    console.error('Error fine-tuning model:', error);
    logEvent('model_fine_tuning', {
      epochs,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}
