// Read-only metadata and an isolated, synthetic demonstration. This module
// deliberately imports the pure engine, not its persistent storage wrapper.
import { createPredictor } from './predictor';
import base from './baseModel.json';
import ranker from './rankerWeights.json';

export const PREDICTION_ALGORITHM = 'Local n-gram model + linear reranker';
export const SYNTHETIC_TRAINING = [
  'we can visit Rowan', 'please visit Rowan', 'let us visit Rowan',
  'we can bring marbles', 'please bring marbles', 'let us bring marbles',
];
// Entire test sentences are withheld from personal training. Shared next-word
// transitions are intentional: this tests n-gram adaptation, not comprehension.
export const SYNTHETIC_HELD_OUT = [
  { sentence: 'tomorrow we visit Rowan', prefix: 'tomorrow we visit', target: 'rowan' },
  { sentence: 'later we bring marbles', prefix: 'later we bring', target: 'marbles' },
];

export function predictionModelInfo() {
  return {
    algorithm: PREDICTION_ALGORITHM,
    baseWords: base.vocab.filter(w => w !== '<s>').length,
    source: 'Authored synthetic seed sentences; reranker trained on synthetic personas',
  };
}

export function runIsolatedLearningDemo() {
  const model = createPredictor({ base, ranker, learningEnabled: false, now: () => 1767603600000 });
  const options = { k: 3 };
  const measure = () => SYNTHETIC_HELD_OUT.map(example => ({
    ...example,
    suggestions: model.predict(example.prefix, options),
  }));
  const baseline = measure();
  const ignoredWhileOff = model.learnFromSpokenSentence(SYNTHETIC_TRAINING[0]) === false;
  model.setLearningEnabled(true);
  SYNTHETIC_TRAINING.forEach(sentence => model.learnFromSpokenSentence(sentence));
  const adapted = measure();
  const trainingStats = model.getPersonalStats();
  model.resetPersonal();
  const reset = measure();
  const hits = rows => rows.filter(row => row.suggestions.some(s => s.word === row.target)).length;
  return {
    baseline, adapted, reset, trainingStats, ignoredWhileOff,
    resetRestoredBaseline: JSON.stringify(reset) === JSON.stringify(baseline),
    hits: { baseline: hits(baseline), adapted: hits(adapted), reset: hits(reset) },
    total: SYNTHETIC_HELD_OUT.length,
    disclaimer: 'Two synthetic examples only. Demonstrates adaptation and reset, not real-world accuracy or superiority. Your personal model is never read or changed by this demo.',
  };
}
