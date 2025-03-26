import axios from 'axios';

const VERTEX_AI_ENDPOINT_URL =
  'https://europe-west4-aiplatform.googleapis.com/v1/projects/ai-powered-aac-app/locations/europe-west4/endpoints/4852032663189454848:predict';

// Load tokenizer correctly
const tokenizerJSON = require('assets/childes_model/crowdsourced_aac_tokenizer.json');
const wordIndex = tokenizerJSON.config.word_index;

const tokenizeSentenceForVertexAI = (sentence) => {
  const maxLength = 4; 
  const words = sentence.toLowerCase().split(' ');

  // Use correct tokenizer mapping
  let tokenized = words.map(word => wordIndex[word] || 0);

  if (tokenized.length < maxLength) {
    tokenized = Array(maxLength - tokenized.length).fill(0).concat(tokenized);
  } else if (tokenized.length > maxLength) {
    tokenized = tokenized.slice(-maxLength);
  }

  console.log("Tokenized for Vertex AI:", tokenized);
  return tokenized;
};

// Fetch AAC text prediction from Vertex AI
export const fetchAACPrediction = async (sentence, accessToken) => {
  try {
    const tokens = tokenizeSentenceForVertexAI(sentence);

    console.log("Sending tokens:", tokens);
    console.log("Using access token:", accessToken.slice(0, 10) + '...');

    const response = await axios.post(
      VERTEX_AI_ENDPOINT_URL,
      { instances: [tokens] },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000  // 10-second timeout
      }
    );

    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.predictions) {
      return response.data.predictions[0];
    } else {
      console.error('Unexpected response structure:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Detailed Vertex AI prediction error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return null;
  }
};
