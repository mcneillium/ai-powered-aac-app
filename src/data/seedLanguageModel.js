// src/data/seedLanguageModel.js
// A small built-in model of what commonly comes next in AAC messages, so the
// suggestion row is useful from the first tap, before (or without) any
// learning. Hand-written around the board's core vocabulary. A few small
// glue words (to, me, am, a) are not board buttons; tapping the suggestion
// is how they get into a message.
//
// Keys and values are lower case. '<s>' is the start of a message.
// Values are ordered most likely first.

export const SEED_NEXT = {
  '<s>': ['i want', 'i need', 'i', 'can i', 'you', 'i feel', 'help', 'no', 'yes', 'stop'],
  'i want': ['more', 'to', 'drink', 'eat', 'go', 'help', 'that', 'play', 'water', 'snack'],
  'i need': ['help', 'the', 'water', 'a', 'break', 'bathroom', 'to', 'more', 'drink'],
  'i feel': ['happy', 'sad', 'tired', 'sick', 'hurt', 'angry', 'scared', 'good', 'bad', 'excited'],
  'can i': ['have', 'go', 'play', 'get', 'see', 'help', 'eat', 'drink'],
  i: ['want', 'need', 'like', 'feel', 'am', 'go', 'see', 'love', 'not'],
  you: ['want', 'like', 'go', 'help', 'see', 'are', 'need'],
  he: ['is', 'want', 'like', 'go'],
  she: ['is', 'want', 'like', 'go'],
  we: ['go', 'want', 'play', 'eat', 'are'],
  they: ['go', 'want', 'are', 'like'],
  it: ['is', 'hurt', 'please', 'more'],
  want: ['more', 'to', 'it', 'that', 'go', 'drink', 'eat', 'play', 'help'],
  need: ['help', 'more', 'the', 'water', 'bathroom', 'to'],
  like: ['it', 'that', 'more', 'play', 'you', 'music'],
  love: ['you', 'it', 'mom', 'dad'],
  go: ['home', 'outside', 'school', 'park', 'bathroom', 'to', 'shop', 'car', 'bed', 'now'],
  to: ['go', 'eat', 'drink', 'play', 'the', 'see', 'home'],
  the: ['bathroom', 'park', 'shop', 'car', 'door', 'ball', 'book', 'tv'],
  is: ['good', 'bad', 'hot', 'cold', 'big', 'small', 'not', 'here', 'there'],
  am: ['happy', 'sad', 'tired', 'hungry', 'thirsty', 'hurt', 'sick', 'done', 'not'],
  not: ['good', 'that', 'now', 'like', 'want', 'happy'],
  help: ['me', 'please', 'you'],
  more: ['please', 'water', 'juice', 'snack', 'food', 'play'],
  eat: ['bread', 'fruit', 'snack', 'more', 'please', 'now'],
  drink: ['water', 'juice', 'milk', 'please', 'more'],
  play: ['ball', 'outside', 'with', 'more', 'toy'],
  see: ['you', 'it', 'that', 'mom', 'dad', 'tv'],
  get: ['it', 'more', 'up', 'the', 'my'],
  open: ['the', 'it', 'door', 'please'],
  close: ['the', 'it', 'door', 'please'],
  give: ['me', 'it', 'more'],
  look: ['at', 'here', 'there'],
  stop: ['please', 'it', 'that'],
  yes: ['please'],
  no: ['thank you', 'more', 'stop'],
  please: ['help', 'more', 'stop'],
  thank: ['you'],
  hi: ['mom', 'dad', 'friend', 'teacher'],
  sorry: ['mom', 'dad'],
  hurt: ['here', 'bad'],
  tired: ['now', 'please'],
  hungry: ['now', 'please'],
  thirsty: ['now', 'please'],
  done: ['now', 'please'],
  wait: ['please'],
};

/** Ranked seed continuations for the last word (or phrase) of a message. */
export function seedNext(previous) {
  const key = (previous || '<s>').toLowerCase().trim();
  return SEED_NEXT[key] || [];
}
