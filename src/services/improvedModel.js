import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

/**
 * Creates an improved next-word prediction model with a deeper architecture.
 * @param {number} vocabSize - Total number of words in your vocabulary.
 * @param {number} sequenceLength - The fixed input sequence length.
 * @returns {tf.Sequential} The compiled TensorFlow.js model.
 */
export function createImprovedModel(vocabSize, sequenceLength) {
  const model = tf.sequential();
  
  // Embedding layer with increased dimensionality
  model.add(tf.layers.embedding({
    inputDim: vocabSize,
    outputDim: 128,  // Increased embedding size for richer word representations
    inputLength: sequenceLength,
  }));
  
  // First LSTM layer, returning sequences for stacking
  model.add(tf.layers.lstm({
    units: 256,
    returnSequences: true,
  }));
  
  // Second LSTM layer to capture deeper sequence patterns
  model.add(tf.layers.lstm({
    units: 256,
    returnSequences: false,
  }));
  
  // Dropout layer for regularization
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Dense layer with softmax activation to output probabilities over the vocabulary
  model.add(tf.layers.dense({
    units: vocabSize,
    activation: 'softmax',
  }));
  
  // Compile the model with an Adam optimizer and appropriate loss function
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy'],
  });
  
  console.log("✅ Improved model created successfully!");
  return model;
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
  let tokenized = words.map(word => tokenizer[word] || 0); // Use 0 for unknown words
  
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
 * @param {number} temperature - Controls the randomness (higher means more diverse).
 * @returns {number} The sampled token index.
 */
function samplePrediction(predictions, temperature = 1.0) {
  // Scale logits by temperature and sample from the probability distribution.
  const logits = tf.div(tf.log(tf.tensor1d(predictions)), tf.scalar(temperature));
  const expLogits = tf.exp(logits);
  const probabilities = expLogits.div(expLogits.sum());
  const sampledIndex = tf.multinomial(probabilities, 1).dataSync()[0];
  return sampledIndex;
}

/**
 * Predicts the next word using the improved model with temperature sampling.
 * @param {tf.Sequential} model - The trained TensorFlow.js model.
 * @param {Object} tokenizer - Object mapping words to indices.
 * @param {string} sentence - The input sentence.
 * @param {number} temperature - Controls the randomness of predictions.
 * @param {number} sequenceLength - The fixed input length required by the model.
 * @returns {Promise<string>} The predicted next word.
 */
export async function predictNextWordWithImprovedModel(model, tokenizer, sentence, temperature = 1.0, sequenceLength = 4) {
  const inputTokens = tokenizeSentence(sentence, tokenizer, sequenceLength);
  if (!inputTokens || inputTokens.length !== sequenceLength) {
    console.error("Tokenized sentence does not match expected length.");
    return "[UNKNOWN]";
  }
  
  const inputTensor = tf.tensor2d([inputTokens], [1, sequenceLength]);
  const prediction = model.predict(inputTensor);
  const predictionData = prediction.dataSync();
  
  // Use sampling to generate a more diverse prediction.
  const predictedIndex = samplePrediction(predictionData, temperature);
  const predictedWord = decodePrediction(predictedIndex, tokenizer);
  
  console.log("✅ Predicted next word:", predictedWord);
  return predictedWord;
}
