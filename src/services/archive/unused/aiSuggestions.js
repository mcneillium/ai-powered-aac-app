export const getAISuggestions = async (sentence) => {
  // If the sentence is empty, return an empty array
  if (sentence.trim().length === 0) {
    return [];
  }
  
  try {
    // Using the general-purpose distilgpt2 model as a baseline.
    // Note: Future development and fine-tuning on an AAC dataset will be required 
    // to improve suggestion relevance and accuracy.
    const apiUrl = "https://api-inference.huggingface.co/models/distilgpt2";
    const hfToken = process.env.EXPO_PUBLIC_HF_API_TOKEN;
    
    // Construct prompt instructing the model to list the top 5 words to continue the sentence.
    const prompt = "List the top 5 words to continue the sentence: " + sentence;
    
    const requestBody = {
      inputs: prompt,
      parameters: {
        max_new_tokens: 1,      // One word suggestions
        do_sample: true,
        num_return_sequences: 1, // Expect one response that contains the list
        temperature: 0.8,
        top_k: 50
      }
    };
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Response error details:", errorText);
      throw new Error("Failed to fetch suggestions from Hugging Face API");
    }
    
    const result = await response.json();
    console.log("Full API response:", result);
    
    // Assume the model returns a single response with generated_text.
    let generatedText = result[0]?.generated_text || "";
    
    // Remove the prompt portion if it appears at the beginning.
    if (generatedText.startsWith(prompt)) {
      generatedText = generatedText.substring(prompt.length);
    }
    
    // Split the output into individual words. This may be comma or newline separated.
    let suggestions = [];
    if (generatedText.includes(',')) {
      suggestions = generatedText.split(',').map(s => s.trim());
    } else if (generatedText.includes('\n')) {
      suggestions = generatedText.split('\n').map(s => s.trim());
    } else {
      suggestions = generatedText.split(' ').map(s => s.trim());
    }
    
    // Filter out empty strings and take the first 5 words.
    suggestions = suggestions.filter(s => s.length > 0).slice(0, 5);
    
    return suggestions;
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return [];
  }
};
