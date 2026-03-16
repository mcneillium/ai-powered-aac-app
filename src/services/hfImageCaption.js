// services/hfImageCaption.js
import * as FileSystem from 'expo-file-system';
import { ENV } from '../config/env';

const HF_CAPTION_API_URL = "https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning";

export const getImageCaption = async (imageUri) => {
  try {
    // Read the image file as a base64-encoded string.
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const requestBody = {
      inputs: base64
    };

    const response = await fetch(HF_CAPTION_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.HUGGING_FACE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching image caption:", errorText);
      throw new Error("Failed to fetch image caption from Hugging Face API");
    }

    const result = await response.json();
    // Assuming the API returns an array with a generated_text field in the first element.
    return result[0]?.generated_text || "No description available";
  } catch (error) {
    console.error("Error in getImageCaption:", error);
    return "Error describing image";
  }
};
