#!/usr/bin/env node
/* eslint-env node */
// Builds src/data/symbolMap.json: board button id -> ARASAAC pictogram id.
// Only ids are stored in the app; pictogram images are downloaded on the
// device when the user turns picture symbols on (Settings › Symbols), so no
// ARASAAC artwork is bundled in the app binary.
//
// ARASAAC pictograms: author Sergio Palao, origin ARASAAC
// (https://arasaac.org), licence CC BY-NC-SA, owner Government of Aragón.
// Usage: node scripts/build-symbol-map.js   (needs network)
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, '..', 'src/data/symbolMap.json');
// Load the vocabulary without the app's module system.
const src = fs.readFileSync(path.join(__dirname, '..', 'src/data/coreVocabulary.js'), 'utf8');
const buttons = [...src.matchAll(/\{ id: '([^']+)', label: '((?:[^'\\]|\\.)*)'/g)].map(m => ({ id: m[1], label: m[2].replace(/\\'/g, "'") }));

// Search terms where the label alone finds the wrong picture.
const TERMS = { start_i_want: 'want', start_i_need: 'need', start_i_feel: 'feel', start_can_i: 'can', mom: 'mother', dad: 'father', ph_pain: 'pain', hot_food: 'hot', cold_food: 'cold', thank_you: 'thank you' };

// Reviewed by eye on a contact sheet: the best search result was the wrong
// picture for these, so the pictogram is chosen explicitly. null = no
// picture (a label-only tile is better than a misleading symbol).
const OVERRIDES = {
  start_can_i: 11750, // "be able to", not a tin can
  stop: 7196,         // stop sign, not a bus stop
  nav_places: 32598,
  nav_phrases: 23402, // conversation
  close: 24976,       // close / shut
  new: 11316,
  old: 4770,
  the: null,
};

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  const map = {};
  for (const b of buttons) {
    if (b.id in OVERRIDES) {
      if (OVERRIDES[b.id]) map[b.id] = OVERRIDES[b.id];
      continue;
    }
    const term = TERMS[b.id] || b.label.toLowerCase();
    const res = await get(`https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(term)}`);
    if (Array.isArray(res) && res[0] && res[0]._id) map[b.id] = res[0]._id;
  }
  fs.writeFileSync(OUT, JSON.stringify(map, null, 0) + '\n');
  console.log(`Mapped ${Object.keys(map).length}/${buttons.length} buttons`);
})();
