// src/services/userFineTuneService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as tf from '@tensorflow/tfjs';

/**
 * Retrieves all user training logs stored locally (by your logger).
 * Assumes logs are saved under the key "userInteractionLog" in AsyncStorage.
 */
export async function getUserTrainingLogs() {
  try {
    const logsString = await AsyncStorage.getItem('userInteractionLog');
    return logsString ? JSON.parse(logsString) : [];
  } catch (error) {
    console.error("Error retrieving user logs:", error);
    return [];
  }
}

/**
 * Given a sentence, splits it into tokens and builds training examples using a sliding window.
 * For each sentence, if it has enough tokens, creates multiple training examples.
 * 
 * For example, with sequenceLength = 4, for sentence "i need to eat food",
 * it creates:
 *   Input: ["i", "need", "to", "eat"] -> Target: "food"
 *
 * @param {string} sentence - The sentence to process.
 * @param {Object} tokenizer - Mapping from word to index.
 * @param {number} sequenceLength - Number of tokens in the input sequence.
 * @returns {Array} - Array of training example objects { inputSequence: number[], targetWord: number }
 */
function buildTrainingExamplesFromSentence(sentence, tokenizer, sequenceLength = 4) {
  const tokens = sentence.trim().toLowerCase().split(/\s+/);
  const examples = [];
  if (tokens.length < sequenceLength + 1) {
    return examples;
  }
  // Create examples using a sliding window
  for (let i = 0; i <= tokens.length - sequenceLength - 1; i++) {
    const inputTokens = tokens.slice(i, i + sequenceLength);
    const targetToken = tokens[i + sequenceLength];
    const inputIndices = inputTokens.map(token => tokenizer[token] || 0);
    const targetIndex = tokenizer[targetToken] || 0;
    examples.push({
      inputSequence: inputIndices,
      targetWord: targetIndex
    });
  }
  return examples;
}

/**
 * Builds training examples from all saved user logs.
 * Each log entry is expected to contain a "sentence" field.
 *
 * @param {Object} tokenizer - Mapping from word to index.
 * @param {number} sequenceLength - Length of the input sequence.
 * @returns {Promise<Array>} - Array of training examples.
 */
export async function buildTrainingExamples(tokenizer, sequenceLength = 4) {
  const logs = await getUserTrainingLogs();
  let trainingExamples = [];
  logs.forEach(log => {
    if (log.sentence) {
      const examples = buildTrainingExamplesFromSentence(log.sentence, tokenizer, sequenceLength);
      trainingExamples = trainingExamples.concat(examples);
    }
  });
  return trainingExamples;
}

/**
 * Fine-tunes the global predictive model using the user's logged inputs.
 * Assumes that:
 *   - The global model is available as global.betterWordPredictionModel.
 *   - The global tokenizer is available as global.tokenizer.
 *
 * @param {number} epochs - Number of epochs to fine-tune.
 */
export async function fineTuneUserModel(epochs = 3) {
  if (!global.betterWordPredictionModel || !global.tokenizer) {
    console.error("Model or tokenizer not loaded.");
    return;
  }
  
  // Build training examples using the saved logs.
  const trainingExamples = await buildTrainingExamples(global.tokenizer, 4);
  if (trainingExamples.length === 0) {
    console.log("No training examples available from logs.");
    return;
  }
  
  console.log(`Fine-tuning on ${trainingExamples.length} training examples.`);
  
  // Create tensors from the training examples.
  const xs = tf.tensor2d(
    trainingExamples.map(example => example.inputSequence),
    [trainingExamples.length, trainingExamples[0].inputSequence.length],
    'int32'
  );
  const ys = tf.tensor1d(
    trainingExamples.map(example => example.targetWord),
    'int32'
  );
  
  // Optionally, unfreeze all layers (if using transfer learning, you might want to unfreeze only certain layers).
  global.betterWordPredictionModel.layers.forEach(layer => {
    layer.trainable = true;
  });
  
  // Recompile the model with a low learning rate for fine-tuning.
  global.betterWordPredictionModel.compile({
    optimizer: tf.train.adam(0.0001),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  // Fine-tune the model on the training examples.
  await global.betterWordPredictionModel.fit(xs, ys, {
    epochs: epochs,
    batchSize: 32,
    shuffle: true,
  });
  console.log("User-specific fine-tuning complete.");
  
  xs.dispose();
  ys.dispose();
}
