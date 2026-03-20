export const getRearrangedSentence = async (sentence) => {
    if (sentence.trim().length === 0) {
      return sentence;
    }
    
    try {
      const apiUrl = "https://api-inference.huggingface.co/models/distilgpt2"; // Using general-purpose model for now
      const hfToken = process.env.EXPO_PUBLIC_HF_API_TOKEN;
      
      // Prompt instructing the model to rearrange the sentence.
      const prompt = "Rearrange the following words into a grammatically correct sentence: " + sentence;
      
      const requestBody = {
        inputs: prompt,
        parameters: {
          max_new_tokens: 50,
          do_sample: true,
          num_return_sequences: 1,
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Rearrangement error details:", errorText);
        throw new Error("Failed to rearrange sentence from Hugging Face API");
      }
      
      const result = await response.json();
      // Assume the model returns a generated_text field.
      let rearranged = result[0]?.generated_text || sentence;
      
      // If the generated text starts with our prompt, remove it.
      if (rearranged.startsWith(prompt)) {
        rearranged = rearranged.substring(prompt.length);
      }
      
      return rearranged.trim();
    } catch (error) {
      console.error('Error fetching rearranged sentence:', error);
      return sentence; // Fall back to original sentence if error occurs
    }
  };
  