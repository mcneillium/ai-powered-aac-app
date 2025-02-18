import axios from 'axios';

// Use the V1 endpoint as defined in the OpenAPI spec.
const BASE_URL = 'https://api.arasaac.org/v1';

/**
 * Searches for pictograms based on a given keyword.
 * Uses the endpoint: GET /pictograms/{language}/search/{searchText}
 *
 * @param {string} language - The language code (e.g. "en", "es").
 * @param {string} searchText - The keyword or phrase to search for.
 * @returns {Promise<Object|null>} - Returns the data (an array of pictogram objects) or null if an error occurs.
 */
export const searchPictograms = async (language, searchText) => {
  try {
    // Construct the endpoint URL using the provided language and search text.
    const endpoint = `${BASE_URL}/pictograms/${language}/search/${encodeURIComponent(searchText)}`;
    
    // Make the GET request using axios.
    const response = await axios.get(endpoint);
    
    // Check if the response status is OK.
    if (response.status === 200) {
      return response.data; // Expected to be an array of Pictogram objects.
    } else {
      console.error(`Unexpected response status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching pictograms:', error);
    return null;
  }
};

/**
 * Helper function to generate a pictogram image URL.
 * The image URL is composed based on the pictogram id and the desired resolution.
 *
 * @param {number|string} id - The pictogram identifier.
 * @param {number} resolution - The desired resolution (e.g. 300, 500, or 2500).
 * @returns {string} - The URL to the pictogram image.
 */
export const getPictogramUrl = (id, resolution = 300) => {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${resolution}.png`;
};

/* 
// Optionally, if you need to retrieve detailed data for a pictogram, you could add a function like this:

export const getPictogramDetails = async (language, id) => {
  try {
    const endpoint = `${BASE_URL}/pictograms/${language}/${id}`;
    const response = await axios.get(endpoint);
    if (response.status === 200) {
      return response.data;
    } else {
      console.error(`Unexpected response status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching pictogram details:', error);
    return null;
  }
};
*/
