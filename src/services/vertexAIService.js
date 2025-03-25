import axios from 'axios';

const VERTEX_AI_ENDPOINT_URL =
  'https://europe-west4-aiplatform.googleapis.com/v1/projects/ai-powered-aac-app/locations/europe-west4/endpoints/4852032663189454848:predict';

// Fetch AAC text prediction from Vertex AI
export const fetchAACPrediction = async (tokens, accessToken) => {
    try {
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
      console.log("Response data:", response.data);
  
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