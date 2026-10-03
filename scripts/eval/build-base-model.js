/* eslint-env node */
// scripts/eval/build-base-model.js
// Builds src/services/prediction/baseModel.json from the authored synthetic
// seed corpus (scripts/eval/data/seed-corpus.txt) plus every board label in
// src/data/coreVocabulary.js. Run: node scripts/eval/build-base-model.js

const fs = require('fs');
const path = require('path');
const { ROOT, requireSrc, loadSeedCorpus, loadBoard } = require('./lib');

const { buildBaseModel } = requireSrc('services/prediction/buildModel.js');

const META = {
  license: '0BSD',
  data: 'Authored synthetic AAC-style sentences written for Voice (scripts/eval/data/seed-corpus.txt). ' +
    'Not derived from CHILDES or any other corpus; no real user data.',
};

function main() {
  const sentences = loadSeedCorpus();
  const { labels } = loadBoard();
  const model = buildBaseModel(sentences, { boardWords: labels, meta: META });
  const out = path.join(ROOT, 'src', 'services', 'prediction', 'baseModel.json');
  const json = JSON.stringify(model);
  fs.writeFileSync(out, json + '\n');
  const triRows = model.tri.length;
  console.log(`baseModel.json: ${sentences.length} sentences, ${model.vocab.length - 1} words, ` +
    `${model.bi.length} bigram histories, ${triRows} trigram histories, ${(json.length / 1024).toFixed(1)} KB`);
}

main();
