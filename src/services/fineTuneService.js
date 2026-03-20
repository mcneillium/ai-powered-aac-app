// src/services/fineTuneService.js
import * as tf from '@tensorflow/tfjs';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Retrieves user training data saved in AsyncStorage.
 * Training data is expected to be stored under the key 'userTrainingLogs'
 * in JSON format, with each log containing:
 * { inputSequence: number[], targetWord: number }
 *
 * @returns {Promise<Array>} - An array of training examples.
 */
export async function getUserTrainingData() {
  try {
    const storedLogs = await AsyncStorage.getItem('userTrainingLogs');
    const logs = storedLogs ? JSON.parse(storedLogs) : [];
    return logs;
  } catch (error) {
    console.error('Error fetching training data:', error);
    return [];
  }
}

/**
 * Fine-tunes the provided model using the supplied training data.
 *
 * @param {tf.LayersModel} model - The current model to fine-tune.
 * @param {Array} trainingData - Array of training examples in the format:
 *   { inputSequence: number[], targetWord: number }
 * @returns {Promise<tf.LayersModel>} - The fine-tuned model.
 */
export async function fineTuneModel(model, trainingData) {
  if (trainingData.length === 0) {
    console.log("No training data available for fine-tuning.");
    return model;
  }
  
  // Convert training data into tensors
  const xs = tf.tensor2d(
    trainingData.map(example => example.inputSequence),
    [trainingData.length, trainingData[0].inputSequence.length],
    'int32'
  );
  const ys = tf.tensor1d(
    trainingData.map(example => example.targetWord),
    'int32'
  );

  // Unfreeze all layers (if using transfer learning, you might selectively unfreeze)
  model.layers.forEach(layer => {
    layer.trainable = true;
  });

  // Recompile the model with a low learning rate for fine-tuning
  model.compile({
    optimizer: tf.train.adam(0.0001),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log("Starting fine-tuning on user training data...");
  await model.fit(xs, ys, {
    epochs: 3,       // Adjust the number of epochs as needed
    batchSize: 32,
    shuffle: true,
  });
  console.log("Fine-tuning complete.");

  xs.dispose();
  ys.dispose();
  return model;
}

/**
 * Periodically retrieves saved user training data and fine-tunes the global model.
 * Clears the saved training logs after successful fine-tuning.
 */
export async function updateModelPeriodically() {
  try {
    const trainingData = await getUserTrainingData();
    // Only fine-tune if sufficient training data is available (e.g., 50 examples)
    if (trainingData.length >= 50) {
      console.log("Sufficient training data found. Fine-tuning the model...");
      // Assume the global model (global.betterWordPredictionModel) is already loaded
      global.betterWordPredictionModel = await fineTuneModel(global.betterWordPredictionModel, trainingData);
      console.log("Global model updated with personalized fine-tuning.");
      // Optionally, clear the training logs after fine-tuning
      await AsyncStorage.removeItem('userTrainingLogs');
    } else {
      console.log("Not enough training data to fine-tune yet. Data count:", trainingData.length);
    }
  } catch (error) {
    console.error("Error during periodic model update:", error);
  }
}

// To trigger periodic fine-tuning, call updateModelPeriodically() from a useEffect with cleanup.
