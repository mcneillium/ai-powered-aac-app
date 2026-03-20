// src/data/coreVocabulary.js
// Local core vocabulary for offline-first AAC communication.
//
// Design principles:
// 1. Core words are high-frequency words that cover ~80% of daily communication
// 2. Button positions are STABLE — the grid layout is deterministic
// 3. Works completely offline — no API calls needed
// 4. Organized by linguistic function, not just topic
// 5. Colors follow modified Fitzgerald Key for part-of-speech coding:
//    - yellow: pronouns/people
//    - green: verbs/actions
//    - blue: adjectives/descriptions
//    - orange: nouns
//    - pink: social/pragmatic
//    - white: miscellaneous
//    - red: important/stop/negation

/**
 * @typedef {Object} VocabButton
 * @property {string} id - Unique stable identifier
 * @property {string} label - Display text and speech text
 * @property {string} category - Fitzgerald Key color category
 * @property {string} color - Background color for the button
 * @property {string} textColor - Text color for readability
 * @property {string} [icon] - Optional Ionicons icon name
 * @property {string} [navigateTo] - If set, tapping navigates to this page
 * @property {number} [arasaacId] - Optional ARASAAC pictogram ID for symbol display
 */

// Core vocabulary pages — each page is a grid of buttons
export const corePages = {
  home: {
    id: 'home',
    label: 'Home',
    buttons: [
      // Row 1: Pronouns + key verbs
      { id: 'i', label: 'I', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'you', label: 'you', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'want', label: 'want', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'go', label: 'go', category: 'verb', color: '#C8E6C9', textColor: '#000' },

      // Row 2: More verbs + social
      { id: 'like', label: 'like', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'need', label: 'need', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'help', label: 'help', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'stop', label: 'stop', category: 'important', color: '#FFCDD2', textColor: '#000' },

      // Row 3: Descriptors + social
      { id: 'more', label: 'more', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'done', label: 'done', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'yes', label: 'yes', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'no', label: 'no', category: 'important', color: '#FFCDD2', textColor: '#000' },

      // Row 4: Navigation to fringe pages
      { id: 'nav_people', label: 'People', category: 'nav', color: '#FFF9C4', textColor: '#000', icon: 'people-outline', navigateTo: 'people' },
      { id: 'nav_food', label: 'Food', category: 'nav', color: '#FFE0B2', textColor: '#000', icon: 'restaurant-outline', navigateTo: 'food' },
      { id: 'nav_places', label: 'Places', category: 'nav', color: '#FFE0B2', textColor: '#000', icon: 'location-outline', navigateTo: 'places' },
      { id: 'nav_feelings', label: 'Feelings', category: 'nav', color: '#F8BBD0', textColor: '#000', icon: 'heart-outline', navigateTo: 'feelings' },

      // Row 5: More core words
      { id: 'not', label: 'not', category: 'important', color: '#FFCDD2', textColor: '#000' },
      { id: 'it', label: 'it', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'is', label: 'is', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'the', label: 'the', category: 'misc', color: '#EEEEEE', textColor: '#000' },

      // Row 6: Common actions
      { id: 'see', label: 'see', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'get', label: 'get', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'make', label: 'make', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'put', label: 'put', category: 'verb', color: '#C8E6C9', textColor: '#000' },

      // Row 7: Social/pragmatic
      { id: 'please', label: 'please', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'thank_you', label: 'thank you', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'sorry', label: 'sorry', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'hi', label: 'hi', category: 'social', color: '#F8BBD0', textColor: '#000' },

      // Row 8: Quick phrases + more navigation
      { id: 'nav_actions', label: 'Actions', category: 'nav', color: '#C8E6C9', textColor: '#000', icon: 'flash-outline', navigateTo: 'actions' },
      { id: 'nav_things', label: 'Things', category: 'nav', color: '#FFE0B2', textColor: '#000', icon: 'cube-outline', navigateTo: 'things' },
      { id: 'nav_describe', label: 'Describe', category: 'nav', color: '#BBDEFB', textColor: '#000', icon: 'color-palette-outline', navigateTo: 'describe' },
      { id: 'nav_phrases', label: 'Phrases', category: 'nav', color: '#F8BBD0', textColor: '#000', icon: 'chatbubbles-outline', navigateTo: 'phrases' },
    ],
  },

  people: {
    id: 'people',
    label: 'People',
    buttons: [
      { id: 'he', label: 'he', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'she', label: 'she', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'we', label: 'we', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'they', label: 'they', category: 'pronoun', color: '#FFF9C4', textColor: '#000' },
      { id: 'mom', label: 'mom', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'dad', label: 'dad', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'brother', label: 'brother', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'sister', label: 'sister', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'friend', label: 'friend', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'teacher', label: 'teacher', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'doctor', label: 'doctor', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'baby', label: 'baby', category: 'noun', color: '#FFE0B2', textColor: '#000' },
    ],
  },

  food: {
    id: 'food',
    label: 'Food & Drink',
    buttons: [
      { id: 'eat', label: 'eat', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'drink', label: 'drink', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'hungry', label: 'hungry', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'thirsty', label: 'thirsty', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'water', label: 'water', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'juice', label: 'juice', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'milk', label: 'milk', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'bread', label: 'bread', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'fruit', label: 'fruit', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'snack', label: 'snack', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'hot_food', label: 'hot', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'cold_food', label: 'cold', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
    ],
  },

  places: {
    id: 'places',
    label: 'Places',
    buttons: [
      { id: 'home_place', label: 'home', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'school', label: 'school', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'outside', label: 'outside', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'bathroom', label: 'bathroom', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'park', label: 'park', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'shop', label: 'shop', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'car', label: 'car', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'bed', label: 'bed', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'here', label: 'here', category: 'misc', color: '#EEEEEE', textColor: '#000' },
      { id: 'there', label: 'there', category: 'misc', color: '#EEEEEE', textColor: '#000' },
      { id: 'up_place', label: 'up', category: 'misc', color: '#EEEEEE', textColor: '#000' },
      { id: 'down_place', label: 'down', category: 'misc', color: '#EEEEEE', textColor: '#000' },
    ],
  },

  feelings: {
    id: 'feelings',
    label: 'Feelings',
    buttons: [
      { id: 'happy', label: 'happy', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'sad', label: 'sad', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'angry', label: 'angry', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'scared', label: 'scared', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'tired', label: 'tired', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'excited', label: 'excited', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'hurt', label: 'hurt', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'sick', label: 'sick', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'good', label: 'good', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'bad', label: 'bad', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'love', label: 'love', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'feel', label: 'I feel', category: 'social', color: '#F8BBD0', textColor: '#000' },
    ],
  },

  actions: {
    id: 'actions',
    label: 'Actions',
    buttons: [
      { id: 'play', label: 'play', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'come', label: 'come', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'open', label: 'open', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'close', label: 'close', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'give', label: 'give', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'take', label: 'take', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'look', label: 'look', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'listen', label: 'listen', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'read', label: 'read', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'write', label: 'write', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'wait', label: 'wait', category: 'verb', color: '#C8E6C9', textColor: '#000' },
      { id: 'turn', label: 'turn', category: 'verb', color: '#C8E6C9', textColor: '#000' },
    ],
  },

  things: {
    id: 'things',
    label: 'Things',
    buttons: [
      { id: 'book', label: 'book', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'ball', label: 'ball', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'phone', label: 'phone', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'toy', label: 'toy', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'tv', label: 'TV', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'clothes', label: 'clothes', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'shoes', label: 'shoes', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'bag', label: 'bag', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'cup', label: 'cup', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'chair', label: 'chair', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'door', label: 'door', category: 'noun', color: '#FFE0B2', textColor: '#000' },
      { id: 'picture', label: 'picture', category: 'noun', color: '#FFE0B2', textColor: '#000' },
    ],
  },

  describe: {
    id: 'describe',
    label: 'Describe',
    buttons: [
      { id: 'big', label: 'big', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'small', label: 'small', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'hot', label: 'hot', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'cold', label: 'cold', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'fast', label: 'fast', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'slow', label: 'slow', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'new', label: 'new', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'old', label: 'old', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'same', label: 'same', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'different', label: 'different', category: 'adjective', color: '#BBDEFB', textColor: '#000' },
      { id: 'all', label: 'all', category: 'misc', color: '#EEEEEE', textColor: '#000' },
      { id: 'some', label: 'some', category: 'misc', color: '#EEEEEE', textColor: '#000' },
    ],
  },

  phrases: {
    id: 'phrases',
    label: 'Quick Phrases',
    buttons: [
      { id: 'ph_idk', label: "I don't know", category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_wait', label: 'Wait please', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_again', label: 'Say that again', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_help', label: 'I need help', category: 'important', color: '#FFCDD2', textColor: '#000' },
      { id: 'ph_bye', label: 'Goodbye', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_name', label: 'My name is', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_how', label: 'How are you?', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_what', label: 'What is that?', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_where', label: 'Where is it?', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_when', label: 'When?', category: 'social', color: '#F8BBD0', textColor: '#000' },
      { id: 'ph_toilet', label: 'I need the toilet', category: 'important', color: '#FFCDD2', textColor: '#000' },
      { id: 'ph_pain', label: 'I am in pain', category: 'important', color: '#FFCDD2', textColor: '#000' },
    ],
  },
};

/**
 * Get all page IDs in display order.
 */
export function getPageIds() {
  return Object.keys(corePages);
}

/**
 * Get a specific page by ID.
 */
export function getPage(pageId) {
  return corePages[pageId] || null;
}

/**
 * Get the home page.
 */
export function getHomePage() {
  return corePages.home;
}
