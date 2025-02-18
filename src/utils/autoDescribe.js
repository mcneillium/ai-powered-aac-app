// src/utils/autoDescribe.js
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

// WARNING: Hardcoding API keys is not recommended for production. 
// Consider using environment variables or a secure key management strategy.
const GOOGLE_CLOUD_VISION_API_KEY = 'AIzaSyD4WZGLy8Zt5VsF6v2LmnikM4j7hcWoo9g';
const GOOGLE_CLOUD_VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`;

export async function autoDescribeImage(uri) {
  try {
    // Read the image file as a base64-encoded string.
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const requestBody = {
      requests: [
        {
          image: { content: base64 },
          features: [
            {
              type: 'LABEL_DETECTION',
              maxResults: 5,
            },
          ],
        },
      ],
    };

    const response = await axios.post(GOOGLE_CLOUD_VISION_API_URL, requestBody);

    if (
      response.status === 200 &&
      response.data.responses &&
      response.data.responses[0].labelAnnotations
    ) {
      const labels = response.data.responses[0].labelAnnotations;
      // Combine detected labels into a descriptive string.
      const description = labels.map((label) => label.description).join(', ');
      return description;
    } else {
      console.error('Invalid response from Vision API:', response.data);
      return 'Unable to describe image';
    }
  } catch (error) {
    console.error('Error in autoDescribeImage:', error);
    return 'Error describing image';
  }
}
