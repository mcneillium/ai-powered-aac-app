// src/utils/vocab.js
// Simple vocabulary mapping for on-device predictions.

const vocabList = [
  '<PAD>', '<UNK>',
  'I','you','he','she','it','we','they',
  'am','are','is','eat','drink','go','come','see','look','like','want','need',
  'yes','no','more','please','thank','sorry','help','stop','play','open','close',
  'food','water','home','school','work','happy','sad','angry','excited','tired','scared',
  'hot','cold','big','small','up','down','left','right','in','out',
  'friend','family','mom','dad','brother','sister',
  'cat','dog','ball','book','car','bus','bike',
  'fast','slow','good','bad','warm','cool'
  // ...add as needed
];

export const word2idx = vocabList.reduce((map, w, i) => { map[w] = i; return map; }, {});
export const idx2word = vocabList.reduce((map, w, i) => { map[i] = w; return map; }, {});

