# Suggestions: how they work and how well (October 2026)

## What the suggestion row is
- **Fixed size.** Four equal slots above the board, always the same height. Empty
  slots stay as dashed outlines rather than collapsing, so neither the row nor the
  board below it moves.
- **Stable slots.** A word that is still suggested keeps its slot as the message
  grows (`placeInSlots`), so the row does not shuffle under the user's finger.
- **Tap only.** A suggestion goes into the message only when it is tapped.
- **Control.** Long-press a suggestion to stop it being suggested; the word stays on
  the board. **Settings › Learning › See what Voice has learned** lists everything
  learned, with *Forget* per word, *Undo* for each "don't suggest", and
  *Clear everything learned*.

## Where suggestions come from (`src/services/predictionEngine.js`)
Pure functions with no storage and no network: the app, the tests and this evaluation
run the same code.

| Source | What it is | When it is used |
|---|---|---|
| Built-in | A small hand-written model of common AAC continuations (`src/data/seedLanguageModel.js`). It looks at the last two words, then the last word | Always |
| Learned | Word, pair and triple counts from this user's messages. Each count halves every 30 days without use | Only with **Learn from my words** on |
| Bundled model | The existing on-device neural model's top words, **kept only if they are real board vocabulary**. Before, it surfaced transcript tokens such as `xxx` | When it has loaded |
| Online | The existing optional server suggestions | Only with *Online suggestions* on, signed in, and only to fill an **empty** slot |

### Privacy defaults
- **Learning is off for new installs.** It is set on the onboarding "Private by
  default" step, in Settings, or on the learned-words screen.
- **Existing users who were already learning keep learning.** Earlier versions learned
  by default, so a user with learned data who had not turned it off keeps it on, and
  their suggestions do not suddenly get worse (`migrateSettings`, tested).
- **Nothing learned leaves the device.** The learning switch is a device-only setting
  that is never synced (`LOCAL_ONLY_KEYS`). The learned model lives only in the
  on-device profile (`@aac_ai_profile`).
- **Earlier learned data is kept.** Its word and pair counts become the starting
  personal model. The original fields are untouched, so Insights keeps working.

## Evaluation
`src/__tests__/predictionEvaluation.test.js` runs in the normal test suite. It replays
two simulated 60-day message logs (`scripts/eval/aacCorpus.js`): a child (Lego,
dinosaurs, a dog called Bella, iPad, swimming) and an adult (medicine, coffee, TV,
calling a sister). Messages are entered as they would be built on the board.
- **History:** the first 70% of each log is learned.
- **Test:** the last 30% is replayed word by word. Learning continues during the test,
  as it would in the app.
- **Hit:** the word the user was about to tap was already in one of the four slots.
- **Taps saved:** compares the taps needed with the row against the taps needed without
  it. A word costs 1 tap on Home and 3 on another page (folder, word, back to Home).

Reproduce with `EVAL_REPORT=1 npx jest src/__tests__/predictionEvaluation.test.js`.

| User | Learning | Words tested | Next word in the 4 slots | Best suggestion was the word | Taps saved |
|---|---|---:|---:|---:|---:|
| Child | off (built-in only) | 98 | 72.4% | 23.5% | 19.7% |
| Child | on (learned on device) | 98 | 79.6% | 55.1% | 21.1% |
| Adult | off (built-in only) | 110 | 31.8% | 11.8% | 0.0% |
| Adult | on (learned on device) | 110 | 78.2% | 49.1% | 4.9% |

### What this shows
- **Learning helps most where the built-in model knows least.** For the adult, the next
  word was in the row 32% of the time without learning and 78% with it.
- **The best suggestion becomes much more reliable.** It is right more than twice as
  often with learning on for both users (24% → 55% for the child, 12% → 49% for the
  adult).
- **The child's built-in figure is high partly by construction.** The child log uses
  many core words that the built-in model was written around.
- **Taps saved are modest.** Most core words are already one tap on Home, so a
  suggestion saves taps mainly for words on sub-pages. The bigger gain is likely to be
  in effort and search, not tap count.

### Limits (please read before quoting the numbers)
- **Simulated users, not real ones.** Both logs were written for this evaluation. The
  numbers show the mechanism works and its direction; they are not a measured benefit
  for real users. A real check needs consented, on-device logging with real AAC users
  and their therapists.
- **The bundled neural model is not included.** It needs the native TensorFlow runtime
  and cannot run in Node. In the app it only adds candidates, and only real vocabulary.
- **Taps saved uses a simple cost model:** 1 tap for Home words and personal words, 3
  for sub-pages. It does not count scrolling or search time.
