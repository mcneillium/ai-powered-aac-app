// src/data/symbols.js
// Picture support for tiles, using the device's own emoji font.
//
// Why emoji: they render offline from the system font (no image files to
// bundle, download or license), scale with the user's text size, and are
// read correctly by screen readers when hidden from accessibility (the tile's
// label already says the word). Small function words such as "the" or "is"
// have no honest picture and stay text-only, as on most AAC core boards.
//
// These are the built-in pictures. Downloaded ARASAAC symbols (Personalise ›
// Picture symbols) take their place where available; a dedicated AAC symbol
// set could replace this map later without changing the board.

const BY_ID = {
  // Home: starters, pronouns, core verbs
  start_i_want: '🙋', start_i_need: '🫴', start_i_feel: '💭', start_can_i: '🙏',
  i: '👆', you: '👉', want: '🤲', go: '🚶', like: '👍', need: '❗', help: '🆘',
  stop: '✋', more: '➕', done: '🏁', yes: '✅', no: '❌', not: '🚫', it: '📦',
  see: '👀', get: '🫳', make: '🛠️', put: '📥', please: '🙏', thank_you: '💐',
  sorry: '😔', hi: '👋',
  // Navigation folders
  nav_people: '👨‍👩‍👧', nav_food: '🍎', nav_places: '🏠', nav_feelings: '😊',
  nav_actions: '🏃', nav_things: '🧸', nav_describe: '🎨', nav_phrases: '💬',
  // People
  he: '👦', she: '👧', we: '👫', they: '👥', mom: '👩', dad: '👨', brother: '👦',
  sister: '👧', friend: '🤝', teacher: '🧑‍🏫', doctor: '🧑‍⚕️', baby: '👶',
  // Food & drink
  eat: '🍽️', drink: '🥤', hungry: '😋', thirsty: '💧', water: '🚰', juice: '🧃',
  milk: '🥛', bread: '🍞', fruit: '🍓', snack: '🍪', hot_food: '🔥', cold_food: '🧊',
  // Places
  home_place: '🏠', school: '🏫', outside: '🌳', bathroom: '🚽', park: '🛝',
  shop: '🛒', car: '🚗', bed: '🛏️', here: '📍', there: '👉', up_place: '⬆️',
  down_place: '⬇️',
  // Feelings
  happy: '😊', sad: '😢', angry: '😠', scared: '😨', tired: '😴', excited: '🤩',
  hurt: '🤕', sick: '🤒', good: '👍', bad: '👎', love: '❤️', feel: '💭',
  // Actions
  play: '🧩', come: '🫶', open: '📂', close: '📁', give: '🎁', take: '✊',
  look: '👀', listen: '👂', read: '📖', write: '✏️', wait: '⏳', turn: '🔄',
  // Things
  book: '📕', ball: '⚽', phone: '📱', toy: '🧸', tv: '📺', clothes: '👕',
  shoes: '👟', bag: '🎒', cup: '☕', chair: '🪑', door: '🚪', picture: '🖼️',
  // Describe
  big: '🐘', small: '🐭', hot: '🔥', cold: '🧊', fast: '🐇', slow: '🐢',
  new: '✨', old: '🕰️', same: '🟰', different: '🔀', all: '💯', some: '🤏',
  // Quick phrases
  ph_idk: '🤷', ph_wait: '⏳', ph_again: '🔁', ph_help: '🆘', ph_bye: '👋',
  ph_name: '📛', ph_how: '🙂', ph_what: '❓', ph_where: '🗺️', ph_when: '🕒',
  ph_toilet: '🚽', ph_pain: '🤕',
};

// Custom words have no id in the map; a few common labels still get a picture.
const BY_LABEL = {
  dog: '🐶', cat: '🐱', music: '🎵', swim: '🏊', bus: '🚌', tablet: '📱',
  pizza: '🍕', apple: '🍎', banana: '🍌', tea: '🫖', coffee: '☕', sleep: '😴',
  walk: '🚶', bath: '🛁', medicine: '💊', grandma: '👵', grandad: '👴', granny: '👵',
};

/** The picture for a tile, or null when there is no honest one. */
export function symbolFor(button) {
  if (!button) return null;
  if (button.emoji) return button.emoji;
  if (button.id && BY_ID[button.id]) return BY_ID[button.id];
  const label = String(button.label || '').trim().toLowerCase();
  return BY_LABEL[label] || null;
}

export const SYMBOL_IDS = Object.keys(BY_ID);
