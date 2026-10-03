/* eslint-env node */
// scripts/eval/evaluate.js
// Offline evaluation of Voice word prediction. Deterministic (fixed seed and
// simulated clock) apart from the latency figures.
//
//   node scripts/eval/evaluate.js           → writes scripts/eval/results.json
//
// ALL DATA ARE SYNTHETIC (authored for this project). Results describe how
// the algorithms behave on that data only. They are NOT evidence of
// real-world communication benefit or developmental benefit.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, requireSrc, shuffle, loadSeedCorpus, loadPersonas, loadBoard, rng } = require('./lib');
const existing = require('./existingApproach');

const { buildBaseModel } = requireSrc('services/prediction/buildModel.js');
const { createPredictor, DEFAULT_WEIGHTS } = requireSrc('services/prediction/predictor.js');
const { tokenize } = requireSrc('services/prediction/tokenize.js');

const SEED = 42;
const TEST_FRACTION = 0.2;
const ADAPT_FRACTION = 0.5;       // personas: learn from first half, test on second
const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);
const STEP = 3 * 3600000;         // simulated time between a persona's sentences
const CHIPS = 3;                  // prediction bar size assumed for savings
const RANKER_PATH = path.join(__dirname, 'ranker-weights.json');
const BASE_MODEL_PATH = path.join(ROOT, 'src', 'services', 'prediction', 'baseModel.json');

const board = loadBoard();
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// ── Cost model for selection savings ──
// Without predictions: a word on the home page = 1 action; on another page =
// 2 (open page + tap); a multi-word button ("I want", "thank you") enters all
// its words for 1 (home) or 2 (other page); a word not on the board is typed:
// letters + 1 to confirm. With predictions: any word shown in the top-3 bar
// costs 1. The cheapest path through the sentence is taken (DP), i.e. the
// user is assumed to notice every useful chip. Board returns to home after
// each selection. No keyboard word-completion in either condition.
function wordCost(w) {
  const where = board.location.get(w);
  if (where === 'home') return 1;
  if (where === 'page') return 2;
  return w.length + 1;
}

function sentenceCost(tokens, top3PerPos) {
  const n = tokens.length;
  const best = new Array(n + 1).fill(Infinity);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    let c = wordCost(tokens[i]);
    if (top3PerPos && top3PerPos[i].includes(tokens[i])) c = Math.min(c, 1);
    best[i + 1] = Math.min(best[i + 1], best[i] + c);
    for (const m of board.multi) {
      const L = m.tokens.length;
      if (i + L > n) continue;
      let ok = true;
      for (let j = 0; j < L; j++) if (tokens[i + j] !== m.tokens[j]) { ok = false; break; }
      if (ok) best[i + L] = Math.min(best[i + L], best[i] + (m.where === 'home' ? 1 : 2));
    }
  }
  return best[n];
}

// ── Generic sequence scorer ──
function newTally() {
  // `sent` keeps per-sentence hits for paired bootstrap comparisons.
  return { tokens: 0, top1: 0, top3: 0, oov: 0, costPred: 0, costBoard: 0, sentences: 0, sent: [] };
}

/**
 * @param tally     accumulator
 * @param tokens    sentence tokens
 * @param suggest   (contextTokens) => string[]  (ranked, lower-case)
 * @param inVocab   (word) => boolean
 */
function scoreSentence(tally, tokens, suggest, inVocab, latencies) {
  const tops = [];
  let h1 = 0;
  let h3 = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t0 = process.hrtime.bigint();
    const preds = suggest(tokens.slice(0, i));
    if (latencies) latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
    const target = tokens[i];
    tally.tokens++;
    if (preds[0] === target) { tally.top1++; h1++; }
    const top3 = preds.slice(0, CHIPS);
    if (top3.includes(target)) { tally.top3++; h3++; }
    if (!inVocab(target)) tally.oov++;
    tops.push(top3);
  }
  tally.costPred += sentenceCost(tokens, tops);
  tally.costBoard += sentenceCost(tokens, null);
  tally.sentences++;
  tally.sent.push([h1, h3, tokens.length]);
}

function summarise(t) {
  return {
    tokens: t.tokens,
    top1: round(t.top1 / t.tokens),
    top3: round(t.top3 / t.tokens),
    oovRate: round(t.oov / t.tokens),
    actionsBoardOnly: t.costBoard,
    actionsWithPrediction: t.costPred,
    selectionSavings: round(1 - t.costPred / t.costBoard),
  };
}

function mergeTallies(list) {
  const out = newTally();
  for (const t of list) {
    for (const k of Object.keys(out)) {
      if (k === 'sent') out.sent.push(...t.sent);
      else out[k] += t[k];
    }
  }
  return out;
}

/**
 * Paired bootstrap over sentences: 95% interval for (B − A) in top-1 and
 * top-3 accuracy. Both tallies must cover the same sentences in order.
 */
function pairedBootstrap(a, b, iters = 2000) {
  const r = rng(SEED + 7);
  const n = a.sent.length;
  const d1 = [];
  const d3 = [];
  for (let it = 0; it < iters; it++) {
    let a1 = 0, a3 = 0, b1 = 0, b3 = 0, tok = 0;
    for (let j = 0; j < n; j++) {
      const k = Math.floor(r() * n);
      a1 += a.sent[k][0]; a3 += a.sent[k][1];
      b1 += b.sent[k][0]; b3 += b.sent[k][1];
      tok += a.sent[k][2];
    }
    d1.push((b1 - a1) / tok);
    d3.push((b3 - a3) / tok);
  }
  const ci = (d) => [round(percentile(d, 0.025)), round(percentile(d, 0.975))];
  return {
    top1Diff: round((b.top1 - a.top1) / a.tokens), top1CI95: ci(d1),
    top3Diff: round((b.top3 - a.top3) / a.tokens), top3CI95: ci(d3),
  };
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ── Systems ──
function engineSuggest(predictor, opts = {}) {
  return (ctx) => predictor.predict(ctx, { k: 6, ...opts }).map(r => r.word);
}

function engineVocab(baseJson, predictor) {
  // Snapshot: personal vocabulary is frozen during the evaluation phase.
  const vocab = new Set(baseJson.vocab);
  if (predictor) for (const w of Object.keys(predictor.exportPersonal().uni)) vocab.add(w);
  return (w) => vocab.has(w);
}

async function main() {
  const lstm = await existing.loadLstm();
  const ranker = fs.existsSync(RANKER_PATH) ? JSON.parse(fs.readFileSync(RANKER_PATH, 'utf8')).weights : null;

  // ── Data ──
  const corpus = loadSeedCorpus();
  const shuffled = shuffle(corpus, SEED);
  const nTest = Math.round(shuffled.length * TEST_FRACTION);
  const test = shuffled.slice(0, nTest);
  const train = shuffled.slice(nTest);
  const trainKeys = new Set(train.map(s => s.key));
  const leak = test.filter(s => trainKeys.has(s.key)).length;
  const trainModel = buildBaseModel(train, { boardWords: board.labels });
  const shippedModel = JSON.parse(fs.readFileSync(BASE_MODEL_PATH, 'utf8'));

  const personas = loadPersonas();
  const evalPersonas = personas.filter(p => p.role === 'eval');
  const tunePersonas = personas.filter(p => p.role === 'tune');
  const corpusKeys = new Set(corpus.map(s => s.key));
  const personaOverlap = {};
  for (const p of personas) {
    personaOverlap[p.id] = p.sentences.filter(s => corpusKeys.has(tokenize(s).join(' '))).length;
  }

  const results = {
    note: 'ALL DATA ARE SYNTHETIC (authored for this project). These numbers describe algorithm behaviour on that data only and are NOT evidence of real-world communication or developmental benefit.',
    seed: SEED,
    assumptions: {
      predictionBarChips: CHIPS,
      costModel: 'home-page word or multi-word button = 1 action; other page = 2 (navigate + tap); word not on board = letters + 1; word shown in top-3 prediction bar = 1; cheapest path per sentence; no keyboard completion',
      personaProtocol: `learn from the first ${ADAPT_FRACTION * 100}% of each persona's sentences in order, then evaluate (frozen) on the remaining sentences only`,
      clock: 'simulated: 3 hours between a persona\'s sentences',
    },
    data: {
      seedSentencesUnique: corpus.length,
      seedTrain: train.length,
      seedTest: test.length,
      seedTrainTestOverlap: leak,
      personas: personas.map(p => ({ id: p.id, role: p.role, mode: p.mode, context: p.context, sentences: p.sentences.length, identicalToSeedSentence: personaOverlap[p.id] })),
    },
  };

  // ── (A) Seed corpus held-out test: cold start, no personal data ──
  {
    const lat = [];
    const tallies = { existing: newTally(), base: newTally(), baseRanker: newTally(), baseTopic: newTally(), baseMode: newTally() };
    const emptyProfile = existing.createProfile();
    const lstmVocab = new Set(lstm ? lstm.outputWords : []);
    const pBase = createPredictor({ base: trainModel, now: () => T0 });
    const pBaseRanker = ranker ? createPredictor({ base: trainModel, now: () => T0, ranker }) : null;
    const inVocab = engineVocab(trainModel, null);
    for (const s of test) {
      const toks = tokenize(s.text);
      scoreSentence(tallies.existing, toks, (ctx) => existing.existingSuggest(emptyProfile, lstm, ctx, T0), (w) => lstmVocab.has(w));
      scoreSentence(tallies.base, toks, engineSuggest(pBase), inVocab, lat);
      if (pBaseRanker) scoreSentence(tallies.baseRanker, toks, engineSuggest(pBaseRanker), inVocab);
      const topic = s.contexts.find(c => c !== 'general');
      scoreSentence(tallies.baseTopic, toks, engineSuggest(pBase, { context: topic }), inVocab);
      scoreSentence(tallies.baseMode, toks, engineSuggest(pBase, { mode: s.mode === 'any' ? undefined : s.mode }), inVocab);
    }
    const topicSubset = test.filter(s => s.contexts.some(c => c !== 'general'));
    const topicT = { off: newTally(), on: newTally() };
    for (const s of topicSubset) {
      const toks = tokenize(s.text);
      const topic = s.contexts.find(c => c !== 'general');
      scoreSentence(topicT.off, toks, engineSuggest(pBase), inVocab);
      scoreSentence(topicT.on, toks, engineSuggest(pBase, { context: topic }), inVocab);
    }
    results.seedHeldOut = {
      description: 'Base model trained on the seed TRAIN split only; scored on unseen TEST sentences. Cold start (no personal data).',
      existingApproach: summarise(tallies.existing),
      newBase: summarise(tallies.base),
      ...(pBaseRanker ? { newBaseRanker: summarise(tallies.baseRanker) } : {}),
      newBaseWithTrueModeTag: summarise(tallies.baseMode),
      topicBias: {
        sentences: topicSubset.length,
        off: summarise(topicT.off),
        on: summarise(topicT.on),
      },
      latencyMs: { p50: round(percentile(lat, 0.5), 3), p95: round(percentile(lat, 0.95), 3), calls: lat.length },
    };
  }

  // ── (B) Personas, temporal protocol ──
  function runPersona(p, opts) {
    const split = Math.floor(p.sentences.length * ADAPT_FRACTION);
    const adapt = p.sentences.slice(0, split);
    const evalSet = p.sentences.slice(split);
    const tallies = {};
    const lat = { base: [], personal: [] };
    const out = {};

    // (i) existing: every word of every adaptation sentence is a tap
    const prof = existing.createProfile();
    adapt.forEach((s, i) => {
      const toks = tokenize(s);
      toks.forEach((w, j) => existing.recordWordSelection(prof, w, toks.slice(0, j), T0 + i * STEP));
    });
    // (ii) base, (iii) base + personal, (iv) + topic, (v) + ranker
    const mk = (extra = {}) => createPredictor({ base: opts.baseModel, learningEnabled: true, weights: opts.weights, ...extra });
    let clock = T0;
    const now = () => clock;
    const pBase = mk({ now });
    const pPers = mk({ now });
    const pRank = opts.ranker ? mk({ now, ranker: opts.ranker }) : null;
    adapt.forEach((s, i) => {
      clock = T0 + i * STEP;
      pPers.learnFromSpokenSentence(s);
      if (pRank) pRank.learnFromSpokenSentence(s);
    });

    // Diagnostic only (never used for selection): would simply trusting
    // personal counts more (α = 16) explain any ranker gain?
    const pHiA = mk({ now, weights: { personalWeight: 16 } });
    adapt.forEach((s, i) => { clock = T0 + i * STEP; pHiA.learnFromSpokenSentence(s); });

    const names = ['existingApproach', 'newBase', 'newBasePersonal', 'newBasePersonalTopic', 'ablationAlpha16'];
    if (pRank) names.push('newBasePersonalRanker');
    for (const n of names) tallies[n] = newTally();
    const lstmVocab = new Set(opts.lstm ? opts.lstm.outputWords : []);
    const baseVocab = engineVocab(opts.baseModel, null);
    const persVocab = engineVocab(opts.baseModel, pPers);
    evalSet.forEach((s, i) => {
      clock = T0 + (split + i) * STEP;
      const toks = tokenize(s);
      scoreSentence(tallies.existingApproach, toks, (ctx) => existing.existingSuggest(prof, opts.lstm, ctx, clock),
        (w) => lstmVocab.has(w) || prof.wordFrequencies[w] !== undefined);
      scoreSentence(tallies.newBase, toks, engineSuggest(pBase, { mode: p.mode }), baseVocab, lat.base);
      scoreSentence(tallies.newBasePersonal, toks, engineSuggest(pPers, { mode: p.mode }), persVocab, lat.personal);
      scoreSentence(tallies.newBasePersonalTopic, toks, engineSuggest(pPers, { mode: p.mode, context: p.context }), persVocab);
      scoreSentence(tallies.ablationAlpha16, toks, engineSuggest(pHiA, { mode: p.mode }), persVocab);
      if (pRank) scoreSentence(tallies.newBasePersonalRanker, toks, engineSuggest(pRank, { mode: p.mode }), persVocab);
    });
    for (const n of names) out[n] = tallies[n];
    return { tallies: out, lat, adaptSentences: adapt.length, evalSentences: evalSet.length, predictor: pPers };
  }

  // Tuning of the personal weight α on the TUNE personas only.
  const tuning = [];
  for (const a of [1, 2, 4, 6, 8, 12, 16, 24]) {
    const ts = tunePersonas.map(p => runPersona(p, { baseModel: shippedModel, weights: { personalWeight: a }, lstm: null }).tallies.newBasePersonal);
    const m = summarise(mergeTallies(ts));
    tuning.push({ personalWeight: a, top1: m.top1, top3: m.top3 });
  }
  // Pre-declared rule: the smallest α whose top-3 is within 0.01 of the best
  // (prefer the least aggressive personalisation that is about as good).
  const bestTop3 = Math.max(...tuning.map(t => t.top3));
  const bestA = tuning.find(t => t.top3 >= bestTop3 - 0.01).personalWeight;
  results.tuning = {
    description: 'personalWeight (α) grid on role=tune personas only; eval personas never used for tuning. Rule: smallest α with top-3 within 0.01 of the best.',
    grid: tuning,
    selectedOnTune: bestA,
    shippedDefault: DEFAULT_WEIGHTS.personalWeight,
  };

  const perPersona = {};
  const all = {};
  const latBase = [];
  const latPers = [];
  const lstmStatsBefore = lstm ? lstm.stats() : null;
  for (const p of evalPersonas) {
    const r = runPersona(p, { baseModel: shippedModel, lstm, ranker });
    perPersona[p.id] = { adaptSentences: r.adaptSentences, evalSentences: r.evalSentences };
    for (const [n, t] of Object.entries(r.tallies)) {
      perPersona[p.id][n] = summarise(t);
      (all[n] = all[n] || []).push(t);
    }
    latBase.push(...r.lat.base);
    latPers.push(...r.lat.personal);
    perPersona[p.id].personalStoreBytes = JSON.stringify(r.predictor.exportPersonal()).length;
    perPersona[p.id].personalStats = r.predictor.getPersonalStats().summary;
  }
  results.personas = {
    description: 'Eval personas (role=eval). Base = shipped model (full seed corpus; personas are not in it except identical common sentences, see data.personas).',
    combined: Object.fromEntries(Object.entries(all).map(([n, ts]) => [n, summarise(mergeTallies(ts))])),
    perPersona,
    latencyMs: {
      base: { p50: round(percentile(latBase, 0.5), 3), p95: round(percentile(latBase, 0.95), 3) },
      basePersonal: { p50: round(percentile(latPers, 0.5), 3), p95: round(percentile(latPers, 0.95), 3) },
    },
  };
  if (lstm) {
    const st = lstm.stats();
    const calls = st.calls - lstmStatsBefore.calls;
    const errors = st.errors - lstmStatsBefore.errors;
    results.existingLstm = {
      loaded: true,
      outputVocabulary: lstm.outputWords,
      personaCalls: calls,
      personaCallsThatThrew: errors,
      note: 'Embedding/output layer has 21 ids, but the app feeds ids from a 5000-word tokenizer; any context word with id >= 21 makes predict() throw (GatherV2 out of range) and getAISuggestions() returns [].',
    };
  } else {
    results.existingLstm = { loaded: false, note: '@tensorflow/tfjs could not be loaded in Node; existing approach measured with bigram/frequency layers only.' };
  }

  // ── (C) Prequential learning curve (predict, then learn) per eval persona ──
  results.learningCurve = {};
  for (const p of evalPersonas) {
    let clock = T0;
    const pr = createPredictor({ base: shippedModel, learningEnabled: true, now: () => clock });
    const prof = existing.createProfile();
    const buckets = [];
    p.sentences.forEach((s, i) => {
      clock = T0 + i * STEP;
      const toks = tokenize(s);
      const b = Math.floor(i / 10);
      buckets[b] = buckets[b] || { sentences: `${b * 10 + 1}-${b * 10 + 10}`, tokens: 0, newTop3: 0, existingTop3: 0 };
      toks.forEach((w, j) => {
        const ctx = toks.slice(0, j);
        buckets[b].tokens++;
        if (pr.predict(ctx, { k: CHIPS, mode: p.mode }).some(r => r.word === w)) buckets[b].newTop3++;
        if (existing.existingSuggest(prof, lstm, ctx, clock).slice(0, CHIPS).includes(w)) buckets[b].existingTop3++;
      });
      pr.learnFromSpokenSentence(s);
      toks.forEach((w, j) => existing.recordWordSelection(prof, w, toks.slice(0, j), clock));
    });
    results.learningCurve[p.id] = buckets.map(b => ({
      sentences: b.sentences, newBasePersonalTop3: round(b.newTop3 / b.tokens), existingTop3: round(b.existingTop3 / b.tokens),
    }));
  }

  // ── (D) Sizes and storage bounds ──
  const shippedRaw = fs.readFileSync(BASE_MODEL_PATH);
  const stress = (() => {
    let clock = T0;
    const pr = createPredictor({ base: shippedModel, learningEnabled: true, now: () => clock });
    const r = rng(SEED);
    const vocab = shippedModel.vocab.slice(1);
    const pool = [...corpus.map(s => s.text), ...personas.flatMap(p => p.sentences)];
    let maxGrams = 0;
    for (let i = 0; i < 3000; i++) {
      clock += 600000;
      // Mix of real-looking sentences and random word strings (worst case for distinct n-grams)
      const s = i % 2 === 0 ? pool[Math.floor(r() * pool.length)]
        : Array.from({ length: 3 + Math.floor(r() * 5) }, () => vocab[Math.floor(r() * vocab.length)]).join(' ');
      pr.learnFromSpokenSentence(s);
      const exp = pr.exportPersonal();
      if (i % 250 === 0 || i === 2999) maxGrams = Math.max(maxGrams, Object.keys(exp.uni).length + Object.keys(exp.bi).length + Object.keys(exp.tri).length);
    }
    const json = JSON.stringify(pr.exportPersonal());
    return { sentences: 3000, maxDistinctNgramsObserved: maxGrams, cap: 5000, bytes: json.length, gzipBytes: zlib.gzipSync(json).length };
  })();
  results.sizes = {
    baseModelBytes: shippedRaw.length,
    baseModelGzipBytes: zlib.gzipSync(shippedRaw).length,
    baseModelWords: shippedModel.vocab.length - 1,
    personalAfterEvalPersonas: Object.fromEntries(Object.entries(perPersona).map(([id, v]) => [id, v.personalStoreBytes])),
    personalStress: stress,
  };

  // ── (E) Behaviour checks: dismissal, decay, reset, learning off ──
  {
    const DAY = 86400000;
    let clock = T0;
    const pr = createPredictor({ base: shippedModel, learningEnabled: true, now: () => clock });
    const dino = evalPersonas.find(p => p.id === 'child_dinosaurs') || evalPersonas[0];
    dino.sentences.forEach((s, i) => { clock = T0 + i * STEP; pr.learnFromSpokenSentence(s); });
    const ctxA = 'I want to see';
    const ctxB = 'I love';
    const has = (ctx, w) => pr.predict(ctx, { k: 6 }).some(r => r.word === w);
    const before = { [ctxA]: has(ctxA, 'grandma'), [ctxB]: has(ctxB, 'grandma') };
    pr.dismissSuggestion('Grandma', ctxA);
    const after = { [ctxA]: has(ctxA, 'grandma'), [ctxB]: has(ctxB, 'grandma') };
    const start = clock;
    clock = start + 13 * DAY;
    const after13d = has(ctxA, 'grandma');
    clock = start + 30 * DAY;
    const after30d = has(ctxA, 'grandma');
    const basePr = createPredictor({ base: shippedModel, now: () => clock });
    pr.resetPersonal();
    const probe = ['', 'I', 'I want', 'I want to', 'can we', 'I need the', 'my'];
    const resetEqualsBase = probe.every(c => JSON.stringify(pr.predict(c)) === JSON.stringify(basePr.predict(c)));
    const off = createPredictor({ base: shippedModel, learningEnabled: false, now: () => clock });
    dino.sentences.forEach(s => off.learnFromSpokenSentence(s));
    results.behaviour = {
      dismissal: {
        word: 'grandma',
        dismissedAfter: ctxA,
        shownBefore: before,
        shownAfterDismiss: after,
        shownAfter13Days: after13d,
        shownAfter30Days: after30d,
        note: 'Dismissal hides the word only after that context word; strength halves every 14 days, so it is hidden while strength >= 0.5 and only down-weighted afterwards.',
      },
      resetReturnsToBase: resetEqualsBase,
      learningOffStoresNothing: off.getPersonalStats().storedItems === 0,
    };
  }

  // ── (F) Ranker decision ──
  if (ranker) {
    const c = results.personas.combined;
    const A = mergeTallies(all.newBasePersonal);
    results.ranker = {
      trainedOn: 'role=tune personas (prequential); see scripts/eval/train-ranker.js',
      weights: ranker,
      evalTop1: { interpolation: c.newBasePersonal.top1, ranker: c.newBasePersonalRanker.top1, alpha16: c.ablationAlpha16.top1 },
      evalTop3: { interpolation: c.newBasePersonal.top3, ranker: c.newBasePersonalRanker.top3, alpha16: c.ablationAlpha16.top3 },
      rankerVsInterpolation: pairedBootstrap(A, mergeTallies(all.newBasePersonalRanker)),
      alpha16VsInterpolation: pairedBootstrap(A, mergeTallies(all.ablationAlpha16)),
      topicVsNoTopic: pairedBootstrap(A, mergeTallies(all.newBasePersonalTopic)),
    };
  }

  const outPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
  printSummary(results);
  console.log(`\nWrote ${path.relative(ROOT, outPath)}`);
}

function printSummary(r) {
  const row = (name, m) => console.log(`  ${name.padEnd(30)} top1 ${m.top1.toFixed(3)}  top3 ${m.top3.toFixed(3)}  OOV ${m.oovRate.toFixed(3)}  savings ${(m.selectionSavings * 100).toFixed(1)}%`);
  console.log('SYNTHETIC DATA ONLY — not evidence of real-world benefit.\n');
  console.log(`Seed held-out (${r.data.seedTest} test sentences, cold start):`);
  row('existing approach', r.seedHeldOut.existingApproach);
  row('new base n-gram', r.seedHeldOut.newBase);
  row('  topic subset: bias off', r.seedHeldOut.topicBias.off);
  row('  topic subset: bias on', r.seedHeldOut.topicBias.on);
  console.log('\nEval personas (adapt on first half, test on second half):');
  for (const [n, m] of Object.entries(r.personas.combined)) row(n, m);
  console.log(`\nTuning α on tune personas: selected ${r.tuning.selectedOnTune}, shipped ${r.tuning.shippedDefault}`);
  console.log(`Latency p50/p95 (ms): base ${r.personas.latencyMs.base.p50}/${r.personas.latencyMs.base.p95}, base+personal ${r.personas.latencyMs.basePersonal.p50}/${r.personas.latencyMs.basePersonal.p95}`);
  console.log(`Base model: ${r.sizes.baseModelBytes} bytes (${r.sizes.baseModelGzipBytes} gzip); personal stress: ${r.sizes.personalStress.maxDistinctNgramsObserved} n-grams max, ${r.sizes.personalStress.bytes} bytes`);
  if (r.ranker) console.log('Ranker vs interpolation (paired bootstrap):', JSON.stringify(r.ranker.rankerVsInterpolation), '\nα16 vs interpolation:', JSON.stringify(r.ranker.alpha16VsInterpolation));
  console.log('Behaviour:', JSON.stringify(r.behaviour.dismissal.shownAfterDismiss), 'reset→base', r.behaviour.resetReturnsToBase, 'learning off stores nothing', r.behaviour.learningOffStoresNothing);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
