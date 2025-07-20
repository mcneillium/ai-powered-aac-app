import axios from 'axios';
import tokenizerJSON from 'assets/childes_model/crowdsourced_aac_tokenizer.json';

const VERTEX_AI_ENDPOINT_URL =
  'https://europe-west4-aiplatform.googleapis.com/v1/projects/ai-powered-aac-app/locations/europe-west4/endpoints/4852032663189454848:predict';

// ✅ Correct tokenizer access
const wordIndex = tokenizerJSON.word_index;
const indexWord = tokenizerJSON.index_word;

const tokenizeSentenceForVertexAI = (sentence) => {
  const maxLength = 4;
  const words = sentence.toLowerCase().split(/\s+/);
  let tokenized = words.map(word => {
    const token = wordIndex[word];
    if (!token) {
      console.warn(`⚠️ Unknown word during tokenization: "${word}" → token 0`);
      return 0;
    }
    return token;
  });

  if (tokenized.length < maxLength) {
    tokenized = Array(maxLength - tokenized.length).fill(0).concat(tokenized);
  } else if (tokenized.length > maxLength) {
    tokenized = tokenized.slice(-maxLength);
  }

  console.log("✅ Tokenized for Vertex AI:", tokenized);
  return tokenized;
};

const decodePrediction = (index) => {
  const word = indexWord?.[String(index)];
  if (!word) {
    console.warn(`⚠️ Predicted index ${index} not found in indexWord map.`);
    return "[UNKNOWN]";
  }
  console.log(`✅ Decoded index ${index} to word "${word}"`);
  return word;
};

export const fetchAACPrediction = async (sentence, accessToken) => {
  try {
    const tokens = tokenizeSentenceForVertexAI(sentence);

    console.log("📡 Sending request to Vertex AI with tokens:", tokens);
    
    const response = await axios.post(
      VERTEX_AI_ENDPOINT_URL,
      { instances: [tokens] },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (!response || !response.data) {
      console.error("❌ No response or response.data from Vertex AI.");
      return null;
    }

    if (!response.data.predictions || !Array.isArray(response.data.predictions)) {
      console.error("❌ 'predictions' field missing or malformed in Vertex response:", response.data);
      return null;
    }

    const predictionVector = response.data.predictions[0];

    if (!Array.isArray(predictionVector)) {
      console.error("❌ Prediction vector is not an array:", predictionVector);
      return null;
    }

    const predictedIndex = predictionVector.indexOf(Math.max(...predictionVector));
    const predictedWord = decodePrediction(predictedIndex);
    const probability = predictionVector[predictedIndex];

    console.log(`✅ Predicted word: "${predictedWord}" (index ${predictedIndex}) with probability ${probability}`);

    return {
      predictedWord,
      probability,
      predictionVector,
    };
  } catch (error) {
    console.error("❌ Vertex AI prediction error (caught exception):", error.message);
    return null;
  }
};
