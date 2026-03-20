// src/services/userFineTuneService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as tf from '@tensorflow/tfjs';
import { ref, push } from 'firebase/database';
import { db } from '../../firebaseConfig';

/**
 * Retrieves user training logs stored locally in AsyncStorage.
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
 * Splits a sentence into tokens and creates training examples using a sliding window.
 * For example, for sentence "i need to eat food" with sequenceLength = 4:
 * Input: ["i", "need", "to", "eat"] → Target: "food"
 */
function buildTrainingExamplesFromSentence(sentence, tokenizer, sequenceLength = 4) {
  const tokens = sentence.trim().toLowerCase().split(/\s+/);
  const examples = [];
  if (tokens.length < sequenceLength + 1) return examples;
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
 * After each epoch, training metrics (loss and accuracy) are pushed to Firebase under "fineTuneMetrics".
 *
 * @param {number} epochs - Number of epochs for fine-tuning (default: 3)
 */
export async function fineTuneUserModel(epochs = 3) {
  if (!global.betterWordPredictionModel || !global.tokenizer) {
    console.error("Model or tokenizer not loaded.");
    return;
  }
  
  // Build training examples from locally stored logs.
  const trainingExamples = await buildTrainingExamples(global.tokenizer, 4);
  if (trainingExamples.length === 0) {
    console.log("No training examples available from logs.");
    return;
  }
  
  console.log(`Fine-tuning on ${trainingExamples.length} training examples.`);
  
  // Create a tensor for inputs (shape: [numExamples, sequenceLength])
  const xs = tf.tensor2d(
    trainingExamples.map(example => example.inputSequence),
    [trainingExamples.length, trainingExamples[0].inputSequence.length],
    'int32'
  );
  
  // Derive vocab size from the model's output layer to stay in sync
  const outputShape = global.betterWordPredictionModel.outputShape;
  const vocabSize = outputShape[outputShape.length - 1];
  const yIndices = tf.tensor1d(
    trainingExamples.map(example => example.targetWord),
    'int32'
  );
  const ys = tf.oneHot(yIndices, vocabSize).toFloat();
  
  // Unfreeze all layers for fine-tuning.
  global.betterWordPredictionModel.layers.forEach(layer => {
    layer.trainable = true;
  });
  
  // Compile model with a low learning rate and categoricalCrossentropy loss.
  global.betterWordPredictionModel.compile({
    optimizer: tf.train.adam(0.0001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  // Callback to push training metrics to Firebase after each epoch.
  const epochEndCallback = {
    onEpochEnd: async (epoch, logs) => {
      console.log(`Epoch ${epoch + 1}: Loss = ${logs.loss}, Accuracy = ${logs.acc || logs.accuracy}`);
      const progressEntry = {
        epoch: epoch + 1,
        loss: logs.loss,
        accuracy: logs.acc || logs.accuracy,
        timestamp: Date.now()
      };
      try {
        const metricsRef = ref(db, 'fineTuneMetrics');
        await push(metricsRef, progressEntry);
        console.log("Training metrics pushed:", progressEntry);
      } catch (error) {
        console.error("Error pushing training metrics to Firebase:", error);
      }
    }
  };
  
  // Fine-tune the model.
  await global.betterWordPredictionModel.fit(xs, ys, {
    epochs: epochs,
    batchSize: 32,
    shuffle: true,
    callbacks: epochEndCallback
  });
  
  console.log("User-specific fine-tuning complete.");
  
  // Dispose tensors to free memory.
  xs.dispose();
  yIndices.dispose();
  ys.dispose();
}
