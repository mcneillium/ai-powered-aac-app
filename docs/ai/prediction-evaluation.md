# Word prediction: method and offline evaluation

> **All data used here is synthetic.** The seed corpus and the "personas" were
> written by hand for this project. The numbers below show how the algorithms
> behave on that data. They are **not** evidence of real-world communication
> benefit or developmental benefit, and they should not be quoted as such.

Reproduce (Node 22, no network, deterministic apart from latency):

```sh
node scripts/eval/build-base-model.js   # → src/services/prediction/baseModel.json
node scripts/eval/train-ranker.js       # → scripts/eval/ranker-weights.json + src/services/prediction/rankerWeights.json
node scripts/eval/evaluate.js           # → scripts/eval/results.json (full numbers)
CI=1 npx jest prediction
```

## 1. What was built

`src/services/prediction/` is pure JS. It has no React, no TensorFlow and no
network access, and it never logs sentence content.

| File | Role |
|---|---|
| `tokenize.js` | Normalisation: lower-case, keeps in-word apostrophes, drops punctuation and `<UNK>`/`[UNKNOWN]` placeholders |
| `buildModel.js` | Build-time counter that writes the compact `voice-ngram` JSON (not used at runtime) |
| `baseModel.json` | Shipped base model: 666 authored sentences + all board labels, 519 words, **33.8 KB (11.7 KB gzip)** |
| `baseIndex.js` | Turns the JSON into Maps once |
| `personalModel.js` | Bounded personal n-gram counts with exponential decay, feedback, export/import |
| `predictor.js` | `createPredictor()`: scoring, learning, dismissal, stats |
| `ranker.js`, `rankerWeights.json` | Tiny linear reranker (7 features). It is shipped; see §5 |
| `personalStore.js` | AsyncStorage persistence per profile: debounced writes and corrupt-data backup |
| `index.js` | Public entry point: `createPersistentPredictor()` |

### Base model
The base model is an interpolated absolute-discount n-gram model (trigram →
bigram → unigram, D = 0.75). It is trained at build time from
`scripts/eval/data/seed-corpus.txt`, a set of short AAC-style sentences written
for Voice (0BSD). They cover requests, refusals ("no thank you", "stop", "I
don't like that"), feelings, help, and home, school, university, work,
shopping, appointment and social topics. Each sentence is tagged with a topic
and a mode (child, adult or any). Every label in `src/data/coreVocabulary.js`
is added as a unigram candidate, so board words that the corpus never uses can
still be reached, for example through prefix completion. **None of the
existing TF model, its tokenizer or CHILDES-derived data is used.**

### Personal layer (opt-in)
The personal layer stores counts for the user's own unigrams, bigrams and
trigrams, plus whole sentences used as phrases. Each count is a `{c, t}` pair,
and its value now is `c · 2^(−age / 45 days)`.

- The personal layer learns **only** from `learnFromSpokenSentence(words)`, and
  only while `learningEnabled` is true. Taps never train it, so words the user
  deletes before pressing Speak are never learned.
- Personal counts are merged into each level of the n-gram model with weight
  α = 8 (one personal use counts as 8 corpus uses). α was tuned on the "tune"
  personas only (§3).
- Limits: at most 5,000 distinct n-grams. When the cap is passed, the store is
  pruned to 90% by lowest decayed count. It also keeps at most 300 accepted
  entries, 300 dismissed entries and 200 phrases. Under stress (3,000 sentences,
  half of them random word strings) the store stayed at ≤ 5,000 n-grams and
  166 KB of JSON (42 KB gzip). After a persona's 22–25 sentences it is 6–10 KB.
- Dismissal is keyed on (previous word, word). It hides the word after that
  previous word while the dismissal's strength is ≥ 0.5. The strength halves
  every 14 days, so the word stays hidden for about 14 days and is down-weighted
  after that. Accepting the word again clears the dismissal. When learning is
  off, dismissals still apply for the session but are never written to storage.
- An optional topic (`context`: home, school, university, work, shopping,
  appointments or social) is used only when the user explicitly chooses it.
  Words that are at least twice as common in that topic's seed sentences get a
  boost (×1.5) and extra unigram weight.
- `mode` ('child' or 'adult') adds unigram weight from that mode's sentences.
  It **never removes vocabulary**, and a test checks this.

## 2. Public API

```js
import { createPersistentPredictor } from '../services/prediction';

const predictor = await createPersistentPredictor({
  profileId: 'default',           // one AsyncStorage key per profile
  learningEnabled: false,         // opt-in; wire to the personalisation setting
});

predictor.predict(contextWords, { k: 6, context, mode, prefix })
// → [{ word, label, score, source: 'base'|'personal', reason, reasonCode }]
//   sync, about 0.1 ms. `label` is the display form ("I", "TV", "Grandma").
//   `score` is only meaningful for ordering. reasonCode is one of
//   personal_next | personal_word | common_next | topic | common_word | board_word.
predictor.predictPhrases(contextWords, { k: 3 })
// → [{ phrase, completion, score, source: 'phrase', reason, reasonCode: 'phrase' }]
//   whole sentences the user has spoken at least twice that start with contextWords.
predictor.learnFromSpokenSentence(words)          // call on Speak only → boolean
predictor.recordSuggestionAccepted(word, wordsBefore)
predictor.dismissSuggestion(word, wordsBefore)
predictor.setLearningEnabled(bool); predictor.isLearningEnabled()
predictor.getPersonalStats()
// → { sentences, words, wordPairs, phrases, dismissed, storedItems, updatedAt,
//     summary: 'Learned from 12 sentences, 30 word pairs.' }
predictor.exportPersonal()                        // plain JSON object
await predictor.importPersonal(json)              // → boolean (invalid input → false)
await predictor.resetPersonal()                   // clears memory and deletes the key
await predictor.flush()                           // write pending changes (app background)
```

`createPredictor({ base, personal, learningEnabled, onPersonalChange, now, weights, limits, ranker })`
is the storage-free core. The tests and the evaluation use it directly.

## 3. Evaluation method

**Data** (`scripts/eval/data/`, all authored and synthetic):

- **Seed corpus:** 666 unique sentences. Duplicates are merged before
  splitting, and the split is by sentence (seed 42): 533 train and 133 test,
  with **0 overlapping sentences**.
- **Personas:** six invented users. Each has 32–50 sentences in temporal order.
  - `role=eval` (used only for reported results): `child_dinosaurs`
    (dinosaurs, swimming, Grandma), `uni_student` (dissertation, supervisor,
    library) and `adult_work` (client, budget report, physio appointment).
  - `role=tune` (used only for choosing α and training the ranker):
    `child_football`, `teen_school` and `retired_gardener`.
  - 2–4 persona sentences per persona happen to be identical to common seed
    sentences (for example "do you want to get a coffee"). They are reported in
    `results.json → data.personas`.

**Protocol for personas:** the system learns from the first 50% of a persona's
sentences in order and is then evaluated, frozen, on the remaining 50% only.
The simulated clock advances 3 hours per sentence. A prequential learning
curve (predict each sentence, then learn it) is also reported in
`results.json → learningCurve`.

**Systems compared:**

1. **Existing approach.** This is a Node re-implementation of the
   `AACBoardScreen` pipeline: `aiProfileStore` bigrams (top 4), merged with the
   bundled static TFJS LSTM (top 4), re-sorted by `scoreWithExplanation`, and
   `getTopWords(6)` for an empty sentence. For personas, the profile learns
   from every word of the adaptation sentences, as taps would. The LSTM **was
   loaded and run** with `@tensorflow/tfjs` (CPU backend) using the app's exact
   input encoding. Not reproduced: `useOnDevicePrediction` (runtime fine-tuning
   with tfjs-react-native) and the cloud Vertex layer (off-device, opt-in).
2. **New base n-gram:** no personal data, which is the cold start.
3. **New base + personal:** interpolation only.
4. **New base + personal + ranker:** the shipped configuration.

There are also diagnostic rows: the explicit topic set to the persona's topic,
and α = 16 as an ablation.

**Metrics:**

- Top-1 and top-3 next-word accuracy over every word position, including the
  first word, where the context is empty.
- OOV rate: the share of target words that are outside the system's
  vocabulary.
- Predict latency.
- Selection savings under this cost model:
  - A word on the home page or a home multi-word button ("I want", "thank you")
    costs 1 action.
  - A word on another page costs 2 actions (open the page, then tap).
  - A word not on the board is typed, costing its letters + 1.
  - A word shown in the **3-chip** prediction bar costs 1 action.
  - Each sentence takes the cheapest path, so the user is assumed to notice
    every useful chip. The board returns to home after each selection, and no
    keyboard completion is assumed.
  - Savings = 1 − actions with prediction ÷ actions with the board only.

## 4. Results

### Seed corpus, held-out test (133 sentences, 619 words, cold start)

| System | Top-1 | Top-3 | OOV | Selection savings |
|---|---|---|---|---|
| Existing approach (empty profile + LSTM) | 0.000 | 0.002 | 65.3% | 0.0% |
| **New base n-gram** (train split only) | **0.380** | **0.515** | 7.3% | **16.0%** |
| New base, topic bias on (101 topic-tagged sentences) | 0.381 (off: 0.379) | 0.518 (off: 0.512) | 8.3% | 16.4% (off: 16.0%) |

With the true mode tag the result was identical to no mode (0.380 / 0.515).
The ranker leaves the cold-start ranking unchanged (identical numbers), and a
test asserts this.

### Eval personas (66 test sentences, 422 words; learned from the earlier 69)

| System | Top-1 | Top-3 | OOV | Selection savings |
|---|---|---|---|---|
| Existing approach (tap-trained profile + LSTM) | 0.348 | 0.543 | 19.0% | 34.4% |
| New base only (cold start) | 0.363 | 0.519 | 17.3% | 18.8% |
| New base + personal (interpolation) | 0.450 | 0.671 | 7.1% | 40.6% |
| + explicit topic | 0.448 | 0.678 | 7.1% | 41.3% |
| **+ ranker (shipped)** | **0.479** | **0.690** | 7.1% | **42.4%** |
| *ablation: interpolation with α = 16* | 0.448 | 0.685 | 7.1% | 41.9% |

Per-persona top-3:

| Persona | Shipped (with ranker) | Interpolation only | Existing approach |
|---|---|---|---|
| child_dinosaurs | 0.711 | 0.676 | 0.599 |
| uni_student | 0.718 | 0.704 | 0.549 |
| adult_work | 0.638 | 0.630 | 0.478 |

In the prequential learning curve, the new engine is ahead of the existing
approach in every 10-sentence bucket. The gap is largest in sentences 1–10
(for example `adult_work`: 0.61 vs 0.18), because the existing pipeline has
nothing to offer before it has learned.

### Existing static LSTM: a finding

The bundled model's embedding and output layers have only **21 ids**. Its
output vocabulary is `. ? you the it i a and that xxx in to no oh do is what
yeah on there`. The app, however, encodes context with the full 5,000-word
tokenizer, so any context word with id ≥ 21 makes `predict()` throw
(`GatherV2: index … not in [0, 20]`), and `getAISuggestions()` then silently
returns `[]`. In the persona runs, **302 of 353 LSTM calls (86%) threw**. When
it does answer, it can suggest `.`, `?` or `xxx`. In practice, the existing
suggestions come almost entirely from the tap-trained bigram and frequency
profile.

### Speed and size

| | Value |
|---|---|
| `predict` latency, base only (p50 / p95) | 0.066 / 0.157 ms |
| `predict` latency, base + personal (p50 / p95) | 0.083 / 0.180 ms |
| Base model JSON | 33,817 B (11,672 B gzip) |
| Ranker weights | under 200 B |
| Personal store after 22–25 sentences | 6.4–10.0 KB |
| Personal store, stress test (3,000 sentences) | ≤ 5,000 n-grams, 166 KB (42 KB gzip) |

Latency was measured with Node 22 on a desktop CPU and is reported once. It
varies between runs; Hermes on a phone will be slower but should stay well
under the 5 ms budget.

### Behaviour checks (also covered by Jest)

- **Dismissal:** "Grandma" was dismissed after "I want to see". It was then
  hidden after "…see" but still offered after "I love". It was still hidden
  13 days later and shown again 30 days later.
- **Reset:** after `resetPersonal()`, predictions are identical to a fresh base
  predictor in all 7 probe contexts.
- **Learning off:** speaking all 50 persona sentences stored 0 items.
- **Cold start:** see the "New base only" rows. The engine gives useful
  predictions with zero personal data, while the existing pipeline gives almost
  none.

## 5. Was the learned ranker kept?

**Yes, with restrictions.** The ranker is a conditional-logit (softmax over
the top 30 candidates) linear model. It was trained on the tune personas only
and evaluated on the eval personas.

On the eval personas, compared with interpolation (paired bootstrap over
sentences, 2,000 resamples):

| | Difference | 95% interval |
|---|---|---|
| Top-1 | +2.8 pts | [+0.9, +4.8] |
| Top-3 | +1.9 pts | [+0.7, +3.3] |

The gain is not just "trust personal data more". Raising α to 16 gives no
top-1 gain (−0.2 pts, interval [−1.7, +1.2]). The learned weights are
`0.82·logP + 0.10·logP_personal − 0.02·logP_base − 0.055·personalOrder`, which
is effectively a geometric blend of the merged and personal-only estimates.

Restrictions:

- A first training run learned a **negative** weight for "recency", which
  penalises words said within the last day. That is an artifact of personas who
  rarely repeat a word on the same day, and it would hurt real users who repeat
  requests. Recency is therefore frozen at 0.
- "accepted" and "contextMatch" have no training signal and are also frozen at
  0. Both still act through logP.
- Without recency, the gain is unchanged (the figures above).

Caveat: this result comes from 3 synthetic eval personas (422 words). The
ranker is cheap (7 multiplications per candidate) and identical to
interpolation at cold start. To switch it off, pass `ranker: null` to
`createPersistentPredictor`.

The topic bias is marginal: +0.7 pts top-3 on personas, interval [0, +1.6],
and +0.6 pts on the seed test. It is kept because it is explicit, cheap, and
never removes words. Mode weighting had no measurable effect.

## 6. Limitations

- The same author wrote the seed corpus and the personas, so their style
  overlaps more than real users would. That makes the n-gram numbers
  optimistic. The seed test sentences are unseen but stylistically close.
- The personas are short (32–50 sentences) and deliberately repetitive.
  Personal-layer gains depend on how much a real person repeats themselves.
- The cost model is idealised: users always notice chips, there is no scanning
  or visual-search cost, and keyboard completion is ignored.
- The existing approach is approximated: the runtime-fine-tuned personal TF
  model and the cloud layer were not run.
- English only. Display casing for proper nouns comes from how the user typed
  them.
