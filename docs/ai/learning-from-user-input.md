# AI Learning from User Input

## Architecture

CommAI uses a two-tier prediction system that genuinely learns from user behaviour over time:

### Tier 1: On-Device Neural Model (TensorFlow.js)
- Pre-trained LSTM model loaded from bundled assets
- Provides baseline word predictions using the tokenizer vocabulary
- Runs entirely on-device via TensorFlow.js React Native backend
- Does NOT learn from user input (static weights, serves as fallback)

### Tier 2: Personalised Frequency Model (AI Profile Store)
- Learns from every word selection, sentence spoken, and suggestion accepted
- Stored locally in AsyncStorage under `@aac_ai_profile`
- **This is the primary personalisation layer**

## What Gets Learned

### Word Frequencies
Every word the user taps is counted. Frequently used words float to the top of suggestions when no context is available (empty sentence bar).

```
profile.wordFrequencies = { "water": 47, "want": 38, "help": 25, ... }
```

### Word Recency
Timestamps track when each word was last used. Recently-used words get a boost in suggestion ranking.

```
profile.wordRecency = { "water": 1711036800000, ... }
```

### Bigram Co-occurrence
When the user taps word B after word A, the pair is recorded. This powers the instant next-word predictions that appear before the neural model responds.

```
profile.bigrams = { "i want": 15, "want water": 8, "thank you": 12, ... }
```

### Phrase Tracking
Sentences of 2-6 words that are spoken are tracked as phrases. Repeated phrases become candidates for quick-phrase suggestions.

```
profile.phraseFrequencies = { "i want water": 6, "thank you": 12, ... }
```

### Suggestion Acceptance
When the user taps an AI suggestion (vs. a grid button), it's marked as `wasSuggestion: true`. This tracks the suggestion acceptance rate.

### Failed Searches
When a pictogram search returns no results, the term is recorded. This identifies vocabulary gaps that caregivers could address.

### Time-of-Day Patterns
Activity is bucketed by hour (0-23) to detect daily communication patterns.

## How Learning Influences Predictions

### On the AAC Board (Primary Screen)

1. **Empty sentence bar:** Shows user's top words by frequency (personalised to their vocabulary)
2. **After typing a word:** Bigram predictions appear instantly (local, no model needed)
3. **Neural model results arrive:** Merged with bigram results, then re-ranked using `scoreByFrequencyAndRecency()`:
   - Log-scaled frequency: `Math.log(freq + 1)`
   - Recency boost: +2.0 if used in the last hour, +1.0 if today, +0.4 if this week
4. **Result:** User's personal communication patterns always rank higher than generic model predictions

### On the Sentence Builder Screen

1. On-device TensorFlow model predicts next words
2. Falls back to `getAISuggestions()` which uses the improved model
3. Word selections are recorded via `recordWordSelection()` for future learning
4. The on-device model also does mini-batch training (`recordTap()`) with a batch size of 4

## Privacy Design

- **Local-only by default:** All learning data stays in AsyncStorage on the device
- **No communication content leaves the device** unless the user explicitly enables cloud sync
- **Privacy-safe summary:** The `getPrivacySafeSummary()` function returns only aggregate counts (e.g., "vocabularySize: 142") — never raw words or sentences
- **User control:** Users can disable personalisation entirely in Settings
- **User control:** Users can reset all learned data in Settings
- **Batched saves:** Profile saves every 10 updates to avoid excessive I/O

## Data Flow

```
User taps word → addWord()
  ├─ speak(word)           ← immediate speech output
  ├─ recordWordSelection() ← updates profile (if enabled)
  │    ├─ wordFrequencies[word]++
  │    ├─ wordRecency[word] = now
  │    ├─ bigrams[prev + word]++
  │    ├─ phraseFrequencies[context + word]++
  │    └─ maybeSave()      ← persists every 10 updates
  └─ setSentenceWords()    ← triggers suggestion refresh
       ├─ getBigramPredictions()      ← instant, local
       ├─ getAISuggestions()          ← async neural model
       └─ scoreByFrequencyAndRecency() ← re-ranks by user data
```

## Limitations

1. The neural model weights are static — they don't update from user input (the on-device training in `useOnDevicePrediction` is session-only and doesn't persist)
2. The frequency model is simple (no n-gram smoothing or backoff)
3. There is no cross-session fine-tuning of the neural model (would require more compute budget)
4. The system learns word-level patterns but not semantic relationships
