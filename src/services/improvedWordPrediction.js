// src/services/improvedWordPrediction.js
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../utils/logger';

// Cache for storing frequently predicted sequences
let predictionCache = {};

// Local frequency-based model for fallback when TensorFlow model isn't working
let frequencyModel = null;

/**
 * Initializes the word prediction system.
 * The TF model is loaded by improvedModelLoader.js at app startup (non-blocking).
 * This function initializes the frequency-based fallback model.
 */
export async function initWordPrediction() {
  try {
    await initFrequencyModel();
    return true;
  } catch (error) {
    console.error("Error initializing word prediction:", error);
    await initFrequencyModel();
    return false;
  }
}

/**
 * Initialize the frequency-based fallback model from stored user data
 */
async function initFrequencyModel() {
  try {
    // Try to load saved frequency data
    const storedFrequencyData = await AsyncStorage.getItem('wordFrequencyModel');
    
    if (storedFrequencyData) {
      frequencyModel = JSON.parse(storedFrequencyData);
      console.log("✅ Frequency model loaded from storage with", 
        Object.keys(frequencyModel).length, "patterns");
    } else {
      // Initialize with common phrases and patterns
      frequencyModel = {
        "i want": ["to", "some", "a", "the", "more"],
        "i need": ["help", "to", "a", "some", "water"],
        "i am": ["happy", "sad", "tired", "hungry", "thirsty"],
        "i feel": ["good", "bad", "sick", "happy", "tired"],
        "can you": ["help", "please", "get", "show", "bring"],
        "i like": ["to", "this", "it", "that", "the"],
        "thank you": ["for", "so", "very", "much", "."],
        "how are": ["you", "they", "we", "things", "the"],
        "where is": ["the", "my", "your", "it", "that"],
        "what time": ["is", "was", "will", "does", "do"]
      };
      
      // Save the initial frequency model
      await AsyncStorage.setItem('wordFrequencyModel', JSON.stringify(frequencyModel));
      console.log("✅ Initial frequency model created");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error initializing frequency model:", error);
    
    // Create a minimal model even if loading failed
    frequencyModel = {
      "i want": ["to", "a", "some"],
      "i need": ["help", "to", "a"],
      "thank you": [".", "very", "much"]
    };
    
    return false;
  }
}

/**
 * Update the frequency model with new input
 * @param {string} prefix - The prefix words (e.g., "I want")
 * @param {string} nextWord - The word that followed the prefix
 */
export async function updateFrequencyModel(prefix, nextWord) {
  try {
    if (!prefix || !nextWord || prefix.length === 0 || nextWord.length === 0) {
      return;
    }
    
    // Normalize inputs
    prefix = prefix.toLowerCase().trim();
    nextWord = nextWord.toLowerCase().trim();
    
    // Get last few words as the key (up to 3 words)
    const words = prefix.split(' ');
    let key = '';
    
    if (words.length >= 2) {
      // Use last two words as key
      key = words.slice(-2).join(' ');
    } else {
      // Use the single word
      key = prefix;
    }
    
    // Update the frequency model
    if (!frequencyModel[key]) {
      frequencyModel[key] = [nextWord];
    } else {
      // If this word is already in the list, move it up in frequency
      const index = frequencyModel[key].indexOf(nextWord);
      if (index !== -1) {
        // Remove it from current position
        frequencyModel[key].splice(index, 1);
      }
      
      // Add it to the front (most frequent position)
      frequencyModel[key].unshift(nextWord);
      
      // Keep only top 10 predictions for each key
      if (frequencyModel[key].length > 10) {
        frequencyModel[key] = frequencyModel[key].slice(0, 10);
      }
    }
    
    // Every 20 updates, save the model to storage
    const updateCount = parseInt(await AsyncStorage.getItem('frequencyUpdateCount') || '0');
    if (updateCount % 20 === 0) {
      await AsyncStorage.setItem('wordFrequencyModel', JSON.stringify(frequencyModel));
      console.log("✓ Frequency model saved to storage");
    }
    await AsyncStorage.setItem('frequencyUpdateCount', (updateCount + 1).toString());
    
  } catch (error) {
    console.error("Error updating frequency model:", error);
  }
}

/**
 * Get word predictions from the frequency model
 * @param {string} inputText - The input text to generate predictions for
 * @param {number} numPredictions - Number of predictions to return
 * @returns {string[]} Array of predicted words
 */
function getFrequencyBasedPredictions(inputText, numPredictions = 5) {
  try {
    if (!frequencyModel || !inputText) {
      return [];
    }
    
    inputText = inputText.toLowerCase().trim();
    
    // Check for exact matches in our model
    for (const key of Object.keys(frequencyModel)) {
      if (inputText.endsWith(key)) {
        // Return the top predictions for this key
        return frequencyModel[key].slice(0, numPredictions);
      }
    }
    
    // No exact match, try to find the best partial match
    const words = inputText.split(' ');
    if (words.length >= 2) {
      const lastTwoWords = words.slice(-2).join(' ');
      
      // Find keys that start with our last two words
      for (const key of Object.keys(frequencyModel)) {
        if (key.startsWith(lastTwoWords)) {
          return frequencyModel[key].slice(0, numPredictions);
        }
      }
      
      // Try just the last word
      const lastWord = words[words.length - 1];
      for (const key of Object.keys(frequencyModel)) {
        if (key.startsWith(lastWord + ' ') || key === lastWord) {
          return frequencyModel[key].slice(0, numPredictions);
        }
      }
    }
    
    // If nothing else worked, return some common words based on the last character
    if (inputText.endsWith('?')) {
      return ['yes', 'no', 'maybe', 'sometimes', 'often'];
    } else if (inputText.endsWith('!')) {
      return ['yes', 'thanks', 'please', 'help', 'now'];
    } else {
      // Just return some common next words
      return ['the', 'to', 'a', 'and', 'is'];
    }
  } catch (error) {
    console.error("Error in frequency predictions:", error);
    return ['the', 'to', 'a', 'and', 'is']; // fallback
  }
}

/**
 * Tokenize the input sentence for the TensorFlow model
 * @param {string} sentence - Input sentence
 * @param {number} sequenceLength - The sequence length required by the model
 * @returns {number[]} Array of token IDs
 */
function tokenizeSentence(sentence, sequenceLength = 4) {
  try {
    if (!global.tokenizer) {
      throw new Error("Tokenizer not loaded");
    }
    
    const words = sentence.toLowerCase().trim().split(/\s+/);
    let tokens = [];
    
    // Convert words to tokens using the tokenizer
    for (const word of words) {
      const tokenId = global.tokenizer[word] || 0; // 0 for unknown tokens
      tokens.push(tokenId);
    }
    
    // Ensure we have the correct sequence length
    if (tokens.length < sequenceLength) {
      // Pad with zeros at the beginning
      tokens = Array(sequenceLength - tokens.length).fill(0).concat(tokens);
    } else if (tokens.length > sequenceLength) {
      // Keep only the last 'sequenceLength' tokens
      tokens = tokens.slice(tokens.length - sequenceLength);
    }
    
    return tokens;
  } catch (error) {
    console.error("Error tokenizing sentence:", error);
    return Array(sequenceLength).fill(0); // Return zeros on error
  }
}

/**
 * Convert token ID back to a word
 * @param {number} tokenId - The token ID to decode
 * @returns {string} The corresponding word
 */
function decodeToken(tokenId) {
  try {
    if (!global.tokenizer) {
      throw new Error("Tokenizer not loaded");
    }
    
    // Find the word corresponding to this token ID
    for (const [word, id] of Object.entries(global.tokenizer)) {
      if (id === tokenId) {
        return word;
      }
    }
    
    return "[UNK]"; // Unknown token
  } catch (error) {
    console.error("Error decoding token:", error);
    return "[ERROR]";
  }
}

/**
 * Get predictions using the TensorFlow model
 * @param {string} inputText - The input text
 * @param {number} numPredictions - Number of predictions to return
 * @param {number} temperature - Controls randomness (higher = more random)
 * @returns {Promise<string[]>} Array of predicted words
 */
async function getTensorFlowPredictions(inputText, numPredictions = 5, temperature = 1.0) {
  try {
    if (!global.betterWordPredictionModel || !global.tokenizer) {
      throw new Error("Model or tokenizer not loaded");
    }
    
    // Check cache first
    const cacheKey = `${inputText}-${numPredictions}-${temperature}`;
    if (predictionCache[cacheKey]) {
      return predictionCache[cacheKey];
    }
    
    // Tokenize the input
    const tokens = tokenizeSentence(inputText);
    
    // Convert to tensor
    const inputTensor = tf.tensor2d([tokens], [1, tokens.length]);
    
    // Get prediction from model
    const predictions = global.betterWordPredictionModel.predict(inputTensor);
    const probabilities = await predictions.data();
    
    // Get the top K predictions
    const topIndices = [];
    for (let i = 0; i < numPredictions; i++) {
      let maxIndex = 0;
      let maxProb = -Infinity;
      
      for (let j = 0; j < probabilities.length; j++) {
        // Skip if this index is already in our results
        if (topIndices.includes(j)) continue;
        
        // Apply temperature scaling for controlled randomness
        const scaledProb = Math.log(probabilities[j] + 1e-10) / temperature;
        
        if (scaledProb > maxProb) {
          maxProb = scaledProb;
          maxIndex = j;
        }
      }
      
      if (maxIndex > 0) { // Skip padding token (0)
        topIndices.push(maxIndex);
      }
    }
    
    // Convert token IDs back to words
    const predictedWords = topIndices.map(index => decodeToken(index))
      .filter(word => word !== "[UNK]" && word !== "[ERROR]");
    
    // Clean up tensors
    inputTensor.dispose();
    predictions.dispose();
    
    // Cache the results
    predictionCache[cacheKey] = predictedWords;
    
    // Limit cache size
    const cacheKeys = Object.keys(predictionCache);
    if (cacheKeys.length > 100) {
      delete predictionCache[cacheKeys[0]];
    }
    
    return predictedWords;
  } catch (error) {
    console.error("Error in TensorFlow predictions:", error);
    return [];
  }
}

/**
 * Main function to get word predictions
 * @param {string} inputText - The input text to generate predictions for
 * @param {number} numPredictions - Number of predictions to return
 * @returns {Promise<string[]>} Array of predicted words
 */
export async function getPredictions(inputText, numPredictions = 5) {
  if (!inputText || inputText.trim().length === 0) {
    return [];
  }
  
  try {
    // Log this prediction request
    logEvent('prediction_request', { inputText, length: inputText.split(' ').length });
    
    // Try to use the TensorFlow model first
    if (global.betterWordPredictionModel && global.tokenizer) {
      try {
        const tfPredictions = await getTensorFlowPredictions(inputText, numPredictions);
        
        if (tfPredictions && tfPredictions.length > 0) {
          return tfPredictions;
        }
      } catch (error) {
        console.log("TensorFlow prediction failed, falling back to frequency model");
      }
    }
    
    // Fall back to frequency-based predictions
    return getFrequencyBasedPredictions(inputText, numPredictions);
  } catch (error) {
    console.error("Error getting predictions:", error);
    return ["I", "you", "the", "to", "and"].slice(0, numPredictions);
  }
}

/**
 * Learn from user input to improve future predictions
 * @param {string} context - The context (previous words)
 * @param {string} selectedWord - The word the user selected
 */
export async function learnFromUserInput(context, selectedWord) {
  try {
    // Update the frequency model
    await updateFrequencyModel(context, selectedWord);
    
    // Log the learning event
    logEvent('prediction_learning', { 
      context, 
      selectedWord,
      success: true
    });
    
    // Eventually this could also be used to collect training data for model fine-tuning
  } catch (error) {
    console.error("Error learning from user input:", error);
  }
}

/**
 * Clear the prediction cache
 */
export function clearPredictionCache() {
  predictionCache = {};
  console.log("Prediction cache cleared");
}

/**
 * Fine-tune the neural model with user data.
 * Delegates to userFineTuneService which does actual on-device training.
 * @param {number} epochs - Number of training epochs
 * @returns {Promise<boolean>} Success status
 */
export async function fineTuneModel(epochs = 3) {
  try {
    const { fineTuneUserModel } = require('./userFineTuneService');
    await fineTuneUserModel(epochs);
    clearPredictionCache();
    return true;
  } catch (error) {
    console.error("Error fine-tuning model:", error);
    return false;
  }
}