# Mobile Change Log

## v1.1.0-rc1 — 2026-03-21 (Release Candidate)

### Android Release Signing
- Production signing config added to build.gradle (env-driven via gradle properties)
- Release builds auto-detect keystore; fall back to debug when not configured
- EAS production build scripts added to package.json
- `keystore.properties` added to .gitignore

### Play Store Readiness
- App name changed to "CommAI" (strings.xml, app.json)
- Removed `WRITE_EXTERNAL_STORAGE` permission (deprecated, unnecessary)
- Scoped `READ_EXTERNAL_STORAGE` to maxSdkVersion=32
- `SYSTEM_ALERT_WINDOW` removed from release builds (dev-only)
- Removed duplicate permissions from app.json
- Brand colors updated in Android resources (colorPrimary → #4CAF50)
- `userInterfaceStyle` set to "automatic" for system theme support
- iOS permission descriptions improved
- Version synchronized: 1.1.0 across package.json, app.json, build.gradle

### AI Personalisation Controls
- Added `aiPersonalisationEnabled` setting (default: true)
- Added "Learn from my usage" toggle in Settings with explanation text
- Added "Reset AI Data" button with destructive confirmation dialog
- `resetAIProfile()` clears all learned data while preserving session count
- `hasLearnedData()` helper for conditional UI display
- All recording calls in AACBoardScreen gated on `aiEnabled`
- Suggestion re-ranking now uses `scoreByFrequencyAndRecency()` for personalised ordering
- Neural model suggestions still shown when personalisation is off (not personalised, just raw)

### UX Polish
- EmotionScreen: all hardcoded #4CAF50 replaced with palette.primary
- Removed unused `AccessibilityInfo` import from AACBoardScreen
- Removed unused `Slider` import from SettingsScreen
- Cleaned duplicate `Alert` import from SettingsScreen

### Testing
- 4 new tests for `resetAIProfile`, `hasLearnedData`, session count preservation
- Total: **36 tests, all passing**

### Documentation
- `/docs/release/android-signing.md` — signing guide
- `/docs/release/google-play-submission-checklist.md` — submission checklist
- `/docs/release/play-store-listing-draft.md` — store listing text
- `/docs/release/data-safety-draft.md` — data safety form answers
- `/docs/ai/learning-from-user-input.md` — how the AI learns
- `/docs/ai/personalisation-controls.md` — user-facing controls
- `/docs/audit/final-mobile-release-audit.md` — full release audit

---

## v1.1.0 — 2026-03-21

### Architecture
- **Unified theme system:** Eliminated 6 duplicate inline palette definitions across screens. All screens now import from `src/theme.js`
- **Extended palette tokens:** Added `success`, `warning`, `inputBg`, `inputBorder`, `chipBg`, `overlay` to all 3 palettes (light, dark, highContrast)
- **Brand constants:** Added `brand` export (`name`, `tagline`, `primaryColor`, `accentColor`) for consistent branding

### Navigation & UX
- **Onboarding overhaul:** Replaced single-page onboarding with 4-slide paginated intro (Welcome, Offline, Personalise, Ready) with skip button and dot indicators
- **Settings header icon:** Added gear icon to tab navigator header bar on all screens for quick settings access
- **Feedback navigation:** Added "Send Feedback" button to Settings screen
- **Themed navigation:** RootStack screens (Settings, Feedback) now inherit theme colors in header
- **SignupScreen fix:** Removed incorrect `navigation.navigate('MainApp')` — auth state now drives navigation correctly

### AAC Board (Primary Screen)
- **AI suggestions strip:** Added contextual word prediction bar below the sentence bar
  - Instant bigram predictions from user's local AI profile
  - Neural model predictions loaded asynchronously
  - Merged and deduplicated, showing up to 6 suggestions
- **Sentence history:** Added history panel (last 20 sentences) accessible from sentence bar, tap to repeat
- **AI profile learning:** Word selections and spoken sentences now recorded for personalized predictions
- **Performance:** Added `removeClippedSubviews` for Android FlatList performance

### AI Inference
- **Eliminated polling:** Replaced busy-wait loop in `getAISuggestions` (500ms × 10 iterations) with `modelReady` Promise pattern
- **Pre-computed reverse tokenizer:** `_indexToWord` map built once at module level instead of on every prediction call
- **LRU prediction cache:** Bounded to 80 entries with FIFO eviction (was unbounded with broken eviction)
- **Frequency model I/O fix:** In-memory update counter instead of reading from AsyncStorage on every frequency update
- **Model warm-up:** Dummy prediction on load eliminates first-inference latency
- **Numerical stability:** Softmax now subtracts max logit before exp to prevent overflow

### Accessibility
- **EmotionScreen animation bug fix:** Each emotion card now has its own `Animated.Value` (was sharing one ref across all cards, causing all cards to scale together)
- **Missing a11y labels:** Added `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` to CommunicationScreen categories, FeedbackScreen inputs, EmotionScreen footer buttons
- **Disabled state feedback:** Added `accessibilityState={{ disabled }}` with visual opacity on buttons
- **Input autofill hints:** Added `autoComplete` and `textContentType` to all auth inputs for password manager support
- **Sentence bar live region:** `accessibilityLiveRegion="polite"` announces sentence changes to screen readers
- **Hit slop:** Added `hitSlop` to small action buttons for easier tap targeting

### Offline
- **Network context:** New `NetworkContext` + `useNetwork()` hook provides app-wide connectivity state
- **Offline banner:** Subtle orange banner shown when offline: "Offline — communication still works"
- **Feedback queueing:** Feedback submissions queued to AsyncStorage when offline, with clear user messaging

### Android Release
- **ProGuard rules:** Added rules for TensorFlow, Firebase, Expo modules, Hermes, React Native bridge
- **Version bump:** 1.0.0 → 1.1.0 (versionCode 1 → 2)

### Auth Screens
- **LoginScreen:** Themed with palette, added branding subtitle, input validation, proper a11y labels
- **SignupScreen:** Themed with palette, proper role toggle buttons with selected state, input validation

### Testing
- **5 new test files** (32 tests total, all passing):
  - `coreVocabulary.test.js` — vocabulary data integrity, navigation targets, Fitzgerald Key validation
  - `theme.test.js` — palette completeness, fallback, brand constants
  - `speechService.test.js` — speech invocation, empty text guards, voice caching
  - `aiProfileStore.test.js` — word frequency, bigrams, sentences, privacy-safe summary
  - `improvedWordPrediction.test.js` — cache, empty inputs, fallback behavior

### Files Changed
| File | Action |
|------|--------|
| `src/theme.js` | Extended with brand constants and new tokens |
| `App.js` | Added NetworkProvider, OfflineBanner, settings header button, themed RootStack |
| `src/screens/AACBoardScreen.js` | AI suggestions, sentence history, AI profile integration |
| `src/screens/OnboardingScreen.js` | Complete rewrite — multi-step onboarding |
| `src/screens/LoginScreen.js` | Themed, a11y, validation |
| `src/screens/SignupScreen.js` | Themed, a11y, validation, bug fix |
| `src/screens/SettingsScreen.js` | Feedback nav, navigation import |
| `src/screens/CommunicationScreen.js` | Unified theme, a11y |
| `src/screens/EasySentenceBuilderScreen.js` | Unified theme |
| `src/screens/EmotionScreen.js` | Animation bug fix, unified theme, a11y |
| `src/screens/CameraScreen.js` | Unified theme |
| `src/screens/LiveSceneModeScreen.js` | Unified theme |
| `src/screens/FeedbackScreen.js` | Complete rewrite — offline queueing, themed, a11y |
| `src/services/improvedModelLoader.js` | Performance: warm-up, pre-computed map, modelReady Promise |
| `src/services/getAISuggestions.js` | Replaced polling with Promise await |
| `src/services/improvedWordPrediction.js` | LRU cache, in-memory counter, numerical stability |
| `src/contexts/NetworkContext.js` | **New** — network state provider |
| `src/components/OfflineBanner.js` | **New** — offline indicator |
| `android/app/proguard-rules.pro` | TF, Firebase, Expo, Hermes rules |
| `android/app/build.gradle` | Version bump |
| `app.json` | Version bump |
| `src/__tests__/*.test.js` | 5 new test files |
| `docs/audit/mobile-audit.md` | **New** — full audit document |
| `docs/mobile/mobile-change-log.md` | **New** — this file |
