/* eslint-env node */
// scripts/eval/train-ranker.js
// Trains the optional linear reranker (src/services/prediction/ranker.js)
// as a conditional-logit (softmax over candidates) model.
//
// Training data: the role=tune synthetic personas ONLY, replayed in order
// (predict each word from what was said before, then learn the sentence).
// The role=eval personas used for reported results are never touched here.
//
//   node scripts/eval/train-ranker.js   → scripts/eval/ranker-weights.json
//
// evaluate.js then compares interpolation vs. interpolation+ranker on the
// eval personas; the ranker ships only if it clearly helps there.

const fs = require('fs');
const path = require('path');
const { ROOT, requireSrc, loadPersonas } = require('./lib');

const { createPredictor } = requireSrc('services/prediction/predictor.js');
const { FEATURE_NAMES } = requireSrc('services/prediction/ranker.js');
const { tokenize } = requireSrc('services/prediction/tokenize.js');

const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);
const STEP = 3 * 3600000;
const TOP_N = 30;        // rerank the interpolation's top 30
const EPOCHS = 400;
const LR = 0.05;
const L2 = 1e-3;

// Features held at weight 0:
// - recency: on the synthetic personas it learns a NEGATIVE weight (they rarely
//   repeat a word within a day), which would penalise real users who repeat
//   requests. We do not trust that sign, so it is frozen.
// - accepted / contextMatch: the training replay has no chip taps and no topic
//   choice, so there is no signal; both already act through logP.
const FROZEN = new Set(['recency', 'accepted', 'contextMatch']);

function collect() {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'services', 'prediction', 'baseModel.json'), 'utf8'));
  const groups = []; // each: { feats: number[][], label: index }
  let missed = 0;
  for (const p of loadPersonas().filter(x => x.role === 'tune')) {
    let clock = T0;
    const pr = createPredictor({ base, learningEnabled: true, now: () => clock });
    p.sentences.forEach((s, i) => {
      clock = T0 + i * STEP;
      const toks = tokenize(s);
      toks.forEach((w, j) => {
        const rows = pr.scoreCandidates(toks.slice(0, j), { mode: p.mode, features: true }).slice(0, TOP_N);
        const label = rows.findIndex(r => r.word === w);
        if (label < 0) { missed++; return; }
        groups.push({ feats: rows.map(r => r.features), label });
      });
      pr.learnFromSpokenSentence(s);
    });
  }
  return { groups, missed };
}

function train(groups) {
  const d = FEATURE_NAMES.length;
  // Start from "pure interpolation": weight 1 on logP, 0 elsewhere.
  const w = new Array(d).fill(0);
  w[0] = 1;
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const grad = new Array(d).fill(0);
    let nll = 0;
    for (const g of groups) {
      const scores = g.feats.map(f => f.reduce((s, x, i) => s + x * w[i], 0));
      const m = Math.max(...scores);
      const ex = scores.map(s => Math.exp(s - m));
      const z = ex.reduce((a, b) => a + b, 0);
      nll -= Math.log(ex[g.label] / z);
      for (let k = 0; k < g.feats.length; k++) {
        const pk = ex[k] / z;
        const y = k === g.label ? 1 : 0;
        for (let i = 0; i < d; i++) grad[i] += (pk - y) * g.feats[k][i];
      }
    }
    for (let i = 0; i < d; i++) {
      if (!FROZEN.has(FEATURE_NAMES[i])) w[i] -= LR * (grad[i] / groups.length + L2 * w[i]);
    }
    if (epoch === EPOCHS - 1) return { w, nll: nll / groups.length };
  }
  return { w, nll: NaN };
}

function main() {
  const { groups, missed } = collect();
  const { w, nll } = train(groups);
  const weights = Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, Math.round(w[i] * 1e4) / 1e4]));
  const out = {
    note: 'Trained on role=tune synthetic personas only. Linear weights over FEATURE_NAMES in src/services/prediction/ranker.js.',
    frozenAtZero: [...FROZEN],
    examples: groups.length,
    targetsOutsideTopN: missed,
    finalMeanNll: Math.round(nll * 1e4) / 1e4,
    weights,
  };
  fs.writeFileSync(path.join(__dirname, 'ranker-weights.json'), JSON.stringify(out, null, 2) + '\n');
  // The app loads only the weights (shipped because evaluate.js shows a gain
  // on the held-out eval personas; see docs/ai/prediction-evaluation.md).
  fs.writeFileSync(path.join(ROOT, 'src', 'services', 'prediction', 'rankerWeights.json'), JSON.stringify(weights) + '\n');
  console.log(`ranker: ${groups.length} examples, NLL ${out.finalMeanNll}`, weights);
}

main();
