// services/hfImageCaption.js
import * as FileSystem from 'expo-file-system';

export const getImageCaption = async (imageUri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const apiUrl = "https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning";
    const hfToken = process.env.EXPO_PUBLIC_HF_API_TOKEN;

    if (!hfToken) {
      console.warn('EXPO_PUBLIC_HF_API_TOKEN not set — HuggingFace captioning unavailable');
      return "Image captioning unavailable (no API token)";
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: base64 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching image caption:", errorText);
      throw new Error("Failed to fetch image caption from Hugging Face API");
    }

    const result = await response.json();
    return result[0]?.generated_text || "No description available";
  } catch (error) {
    console.error("Error in getImageCaption:", error);
    return "Error describing image";
  }
};
