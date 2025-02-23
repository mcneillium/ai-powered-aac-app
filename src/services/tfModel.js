import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

// Directly require the model JSON and weights
const modelJson = require('../../assets/tf_model/word_prediction_tfjs/model.json');
const modelWeights = [require('../../assets/tf_model/word_prediction_tfjs/group1-shard1of1.bin')];
const tokenizerModule = require('../../assets/tf_model/tokenizer.json');

export async function loadModel() {
  try {
    await tf.ready();
    console.log("TensorFlow.js is ready!");

    // Load the model directly from the bundled resources
    const model = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
    console.log("Model loaded successfully!");

    // Load tokenizer
    const tokenizer = tokenizerModule;
    console.log("Tokenizer loaded successfully!");

    global.modelLoaded = true;
    return { model, tokenizer };
  } catch (error) {
    console.error("Error in loadModel:", error);
    throw error;
  }
}
