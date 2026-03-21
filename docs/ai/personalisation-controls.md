# AI Personalisation Controls

## User-Facing Controls

### Settings → AI Personalisation

#### "Learn from my usage" Toggle
- **Location:** Settings screen, under "AI Personalisation" section
- **Setting key:** `aiPersonalisationEnabled` (boolean, default: `true`)
- **When ON:**
  - Word selections are recorded to the AI profile
  - Spoken sentences are recorded for phrase learning
  - Bigram co-occurrences are tracked
  - Suggestion acceptance is tracked
  - Suggestions are re-ranked based on personal frequency and recency
  - Failed searches are recorded for vocabulary gap detection
- **When OFF:**
  - No data is written to the AI profile
  - Existing learned data is preserved but not used for ranking
  - Neural model suggestions still appear (they're not personalised)
  - Bigram predictions are not shown
  - Top words are not shown on empty sentence bar

#### "Reset AI Data" Button
- **Visibility:** Only shown when the profile has learned data (`hasLearnedData()`)
- **Action:** Clears all learned patterns (word frequencies, bigrams, phrases, recency, failed searches)
- **Preserved:** Session count (for aggregate analytics only)
- **Confirmation:** Alert with "Cancel" / "Reset" (destructive style)
- **Irreversible:** Cannot be undone

## Technical Implementation

### Data Storage
- **Key:** `@aac_ai_profile` in AsyncStorage
- **Format:** JSON object (see `createDefaultProfile()` in `aiProfileStore.js`)
- **Save frequency:** Every 10 updates (configurable via `SAVE_INTERVAL`)
- **Force save:** `flushAIProfile()` should be called on app background

### Setting Propagation
1. `SettingsContext` stores `aiPersonalisationEnabled`
2. `AACBoardScreen` reads the setting as `aiEnabled`
3. All `recordWordSelection()`, `recordSentenceSpoken()`, and `recordSuggestionsShown()` calls are gated on `aiEnabled`
4. Suggestion fetch logic checks `aiEnabled` before using bigram or top-word features
5. `scoreByFrequencyAndRecency()` is only applied when `aiEnabled` is true

### Privacy Guarantees
- No communication content is synced to Firebase by default
- `getPrivacySafeSummary()` only returns aggregate counts
- The profile is stored in device-local storage only
- Disabling personalisation does not delete existing data (user must explicitly reset)
- The AI profile is not included in Firebase settings sync

### Caregiver Visibility
- `getPrivacySafeSummary()` can be synced to the dashboard for caregivers (opt-in)
- Exposed metrics: session count, word selection count, sentence count, vocabulary size, suggestion acceptance rate, failed search count, repeated phrase count
- NOT exposed: actual words, sentences, or communication content
