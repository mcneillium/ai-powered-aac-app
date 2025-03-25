import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

/**
 * Creates a better next-word prediction model using an embedding layer, LSTM, dropout, and dense output.
 * @param {number} vocabSize - Total number of words in your vocabulary.
 * @param {number} sequenceLength - The fixed input sequence length.
 * @returns {tf.Sequential} The compiled TensorFlow.js model.
 */
export function createBetterModel(vocabSize, sequenceLength) {
  const model = tf.sequential();
  
  // Embedding layer to convert word indices to dense vectors.
  model.add(tf.layers.embedding({
    inputDim: vocabSize,
    outputDim: 64,
    inputLength: sequenceLength,
  }));
  
  // LSTM layer to capture sequence patterns.
  model.add(tf.layers.lstm({
    units: 128,
    returnSequences: false, // Only the final output is needed.
  }));
  
  // Dropout layer to help prevent overfitting.
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  // Dense layer with softmax to output probabilities over the vocabulary.
  model.add(tf.layers.dense({
    units: vocabSize,
    activation: 'softmax',
  }));
  
  // Compile the model with an optimizer and loss function suitable for classification.
  model.compile({
    optimizer: tf.train.adam(),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy'],
  });
  
  console.log("✅ Better model created successfully!");
  return model;
}

/**
 * Trains the model using provided training data.
 * @param {tf.Sequential} model - The TensorFlow.js model to train.
 * @param {tf.Tensor} XTrain - Input tensor of shape [numSamples, sequenceLength].
 * @param {tf.Tensor} yTrain - Label tensor of shape [numSamples] (each label is a word index).
 * @returns {Promise} Training history.
 */
export async function trainBetterModel(model, XTrain, yTrain) {
  const history = await model.fit(XTrain, yTrain, {
    epochs: 20,
    batchSize: 64,
    validationSplit: 0.1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
      },
    },
  });
  console.log("✅ Model training complete!");
  return history;
}

/**
 * Tokenizes a sentence using a given tokenizer and pads/truncates it to the desired sequence length.
 * @param {string} sentence - The input sentence.
 * @param {Object} tokenizer - Object mapping words to indices.
 * @param {number} sequenceLength - The fixed length required by the model.
 * @returns {number[]} The tokenized and padded/truncated sentence.
 */
function tokenizeSentence(sentence, tokenizer, sequenceLength) {
  const words = sentence.toLowerCase().split(" ");
  let tokenized = words.map(word => tokenizer[word] || 0); // 0 for unknown or missing words
  
  // Pad with zeros at the beginning if needed.
  if (tokenized.length < sequenceLength) {
    tokenized = Array(sequenceLength - tokenized.length).fill(0).concat(tokenized);
  } else if (tokenized.length > sequenceLength) {
    tokenized = tokenized.slice(-sequenceLength); // Truncate from the beginning
  }
  
  console.log("🔢 Tokenized sentence:", tokenized);
  return tokenized;
}

/**
 * Finds the word corresponding to a token index using the tokenizer.
 * @param {number} index - The predicted token index.
 * @param {Object} tokenizer - Object mapping words to indices.
 * @returns {string} The corresponding word, or "[UNKNOWN]" if not found.
 */
function decodePrediction(index, tokenizer) {
  return Object.keys(tokenizer).find(word => tokenizer[word] === index) || "[UNKNOWN]";
}

/**
 * Samples an index from the model's prediction probabilities using temperature sampling.
 * @param {Float32Array|number[]} predictions - Array of prediction probabilities.
 * @param {number} temperature - A value to adjust randomness (higher = more diverse).
 * @returns {number} The sampled token index.
 */
function samplePrediction(predictions, temperature = 1.0) {
  // Convert predictions to a tensor and apply temperature scaling.
  const logits = tf.div(tf.log(tf.tensor1d(predictions)), tf.scalar(temperature));
  const expLogits = tf.exp(logits);
  const probabilities = expLogits.div(expLogits.sum());
  
  // Sample from the probability distribution.
  const sampledIndex = tf.multinomial(probabilities, 1).dataSync()[0];
  return sampledIndex;
}

/**
 * Predicts the next word using the provided model and tokenizer with temperature sampling.
 * @param {tf.Sequential} model - The trained TensorFlow.js model.
 * @param {Object} tokenizer - Object mapping words to indices.
 * @param {string} sentence - The input sentence.
 * @param {number} temperature - Controls the randomness of predictions.
 * @param {number} sequenceLength - The fixed input length required by the model.
 * @returns {Promise<string>} The predicted next word.
 */
export async function predictNextWordWithSampling(model, tokenizer, sentence, temperature = 1.0, sequenceLength = 4) {
  const inputTokens = tokenizeSentence(sentence, tokenizer, sequenceLength);
  if (!inputTokens || inputTokens.length !== sequenceLength) {
    console.error("Tokenized sentence does not match expected length.");
    return "[UNKNOWN]";
  }
  
  const inputTensor = tf.tensor2d([inputTokens], [1, sequenceLength]);
  const prediction = model.predict(inputTensor);
  const predictionData = prediction.dataSync();
  
  // Sample an index instead of simply using argMax.
  const predictedIndex = samplePrediction(predictionData, temperature);
  const predictedWord = decodePrediction(predictedIndex, tokenizer);
  
  console.log("✅ Predicted next word:", predictedWord);
  return predictedWord;
}
