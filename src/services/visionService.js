// services/visionService.js
// Google Cloud Vision API integration for image labeling/description.
// Falls back to HuggingFace captioning if Vision API key is not configured.
import * as FileSystem from 'expo-file-system';
import { getImageCaption as hfCaption } from './hfImageCaption';

const VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY;

/**
 * Calls Google Cloud Vision API to get labels for an image.
 * Returns a human-readable description string.
 */
export async function getVisionLabels(imageUri) {
  if (!VISION_API_KEY) {
    // Fall back to HuggingFace captioning
    return hfCaption(imageUri);
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
    const body = {
      requests: [
        {
          image: { content: base64 },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 5 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 5 },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', errorText);
      throw new Error('Vision API request failed');
    }

    const data = await response.json();
    const annotations = data.responses?.[0];

    // Combine labels and object names into a readable description
    const labels = (annotations?.labelAnnotations || [])
      .map(l => l.description)
      .slice(0, 3);
    const objects = (annotations?.localizedObjectAnnotations || [])
      .map(o => o.name)
      .slice(0, 3);

    const unique = [...new Set([...objects, ...labels])].slice(0, 5);
    if (unique.length === 0) return 'No objects detected';

    return `I see: ${unique.join(', ')}`;
  } catch (error) {
    console.error('Vision labeling error:', error);
    // Fall back to HuggingFace
    return hfCaption(imageUri);
  }
}
