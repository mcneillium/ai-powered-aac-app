// src/services/prediction/ranker.js
// Optional linear reranker over per-candidate features.
//
// The predictor always computes an interpolated n-gram probability. When a
// weight vector is supplied (createPredictor({ ranker })), candidates are
// re-ordered by  w · features  instead. Weights are trained offline by
// scripts/eval/train-ranker.js; see docs/ai/prediction-evaluation.md for
// whether shipping them is justified.

export const FEATURE_NAMES = [
  'logP',          // log interpolated (base + personal) probability
  'logPBase',      // log base-only probability
  'logPPersonal',  // log personal-only probability (floored)
  'recency',       // 2^(-days since the user last said this word here)
  'accepted',      // decayed count of accepting this word in this context (capped 3)
  'contextMatch',  // 1 if the word belongs to the chosen topic, else 0
  'personalOrder', // longest personal n-gram that predicts it: 0, 1/3, 2/3, 1
];

export function rankerScore(weights, features) {
  let s = weights.bias || 0;
  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    s += (weights[FEATURE_NAMES[i]] || 0) * features[i];
  }
  return s;
}
