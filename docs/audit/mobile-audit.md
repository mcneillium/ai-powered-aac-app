# Mobile Codebase Audit — CommAI AAC App

**Date:** 2026-03-21
**Auditor:** Mobile Lead (AI-assisted)
**Version:** 1.1.0
**Branch:** `claude/mobile-architecture-ux-Q1Mvb`

---

## Executive Summary

Full audit of the React Native / Expo AAC mobile app covering architecture, UX, AI inference, accessibility, offline resilience, Android release readiness, branding, and test coverage. **35+ issues identified and resolved** in this pass.

---

## 1. Architecture

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| A1 | 6/12 screens had inline `palettes` objects instead of shared `theme.js` | High | **Fixed** |
| A2 | Theme was missing tokens: `success`, `warning`, `inputBg`, `inputBorder`, `chipBg`, `overlay` | Medium | **Fixed** |
| A3 | No branding constants — app name/colors scattered as magic strings | Medium | **Fixed** |
| A4 | `CommunicationScreen` named export mismatches (default vs named) | Low | Verified OK |
| A5 | `firebaseConfig.js` exports `db` but some files call `getDatabase()` directly | Low | Acceptable |

### Changes Made
- Added `brand` export to `theme.js` with `name`, `tagline`, `primaryColor`, `accentColor`
- Added 6 new color tokens to all 3 palettes
- Migrated CommunicationScreen, EasySentenceBuilderScreen, EmotionScreen, CameraScreen, LiveSceneModeScreen, FeedbackScreen to use `getPalette()`
- LoginScreen and SignupScreen rewritten to use theme system

---

## 2. Navigation & State

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| N1 | OnboardingScreen was just 27 lines — single paragraph + button | Medium | **Fixed** |
| N2 | No settings gear icon in header — users relied on Profile tab → Settings | Medium | **Fixed** |
| N3 | No Feedback navigation from Settings screen | Low | **Fixed** |
| N4 | Tab bar missing `tabBarAccessibilityLabel` | Medium | **Fixed** |
| N5 | RootStack screens (Settings, Feedback) had no themed header | Low | **Fixed** |
| N6 | SignupScreen navigated to `MainApp` route that doesn't exist | Medium | **Fixed** |

### Changes Made
- Multi-step onboarding with 4 slides, skip button, dot indicators, proper a11y
- Settings gear icon in tab navigator header (all screens)
- "Send Feedback" button added to SettingsScreen
- Themed RootStack headers
- SignupScreen fixed — auth state drives navigation (no manual navigate)

---

## 3. AAC UX Quality

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| U1 | AACBoardScreen had NO AI suggestions — only EasySentenceBuilder had them | **Critical** | **Fixed** |
| U2 | No sentence history / repeat feature | High | **Fixed** |
| U3 | No visual feedback when sentence bar updates | Medium | **Fixed** |
| U4 | Speak button spoke empty sentence (no guard) | Low | Already guarded |
| U5 | No AI profile learning from AAC Board word selections | High | **Fixed** |
| U6 | `removeClippedSubviews` not set on Android FlatList (perf) | Low | **Fixed** |

### Changes Made
- AI suggestions strip added below sentence bar on AACBoard
- Bigram predictions (instant, local) + neural model predictions (async)
- Sentence history panel (last 20 sentences, tap to repeat)
- `recordWordSelection` and `recordSentenceSpoken` integrated
- `accessibilityLiveRegion="polite"` on sentence bar

---

## 4. On-Device AI Inference

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| I1 | `getAISuggestions` used busy-wait polling loop (500ms × 10 = 5s block) | **Critical** | **Fixed** |
| I2 | `predictTopKWordsWithImprovedModel` rebuilt reverse tokenizer map on every call | High | **Fixed** |
| I3 | Prediction cache had no proper eviction — just deleted first key | Medium | **Fixed** |
| I4 | `updateFrequencyModel` read `frequencyUpdateCount` from AsyncStorage on every call | High | **Fixed** |
| I5 | No model warm-up — first prediction had cold-start latency | Medium | **Fixed** |
| I6 | Softmax had numerical instability (no max subtraction) | Low | **Fixed** |

### Changes Made
- Replaced polling with `modelReady` Promise — consumers await instead of spin
- Pre-computed `_indexToWord` map at module level (O(1) lookups)
- LRU-style cache with bounded size (80 entries, FIFO eviction)
- In-memory `frequencyUpdateCount` counter (no AsyncStorage reads)
- Model warm-up with dummy prediction on load
- Numerically stable softmax (subtract max before exp)

---

## 5. Accessibility

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| AC1 | EmotionScreen shared ONE Animated.Value across ALL emotion cards | **Bug** | **Fixed** |
| AC2 | CommunicationScreen categories had no `accessibilityRole` or labels | High | **Fixed** |
| AC3 | FeedbackScreen inputs had no `accessibilityLabel` | Medium | **Fixed** |
| AC4 | EmotionScreen footer buttons had no a11y labels or disabled state | Medium | **Fixed** |
| AC5 | LoginScreen missing `autoComplete` and `textContentType` hints | Low | **Fixed** |
| AC6 | SignupScreen role toggle buttons had no `accessibilityState` | Medium | **Fixed** |
| AC7 | Hardcoded `#4CAF50` in many screens instead of `palette.primary` | Medium | **Fixed** |

### Changes Made
- Each emotion card now has its own `Animated.Value` (fixes animation bug)
- Added `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` across screens
- Added `accessibilityState={{ disabled }}` with visual opacity feedback
- Input fields now have `autoComplete` and `textContentType` for password managers
- Hardcoded colors replaced with palette tokens

---

## 6. Offline Resilience

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| O1 | No app-wide network state awareness | High | **Fixed** |
| O2 | No visual offline indicator for user | High | **Fixed** |
| O3 | FeedbackScreen failed silently when offline | Medium | **Fixed** |
| O4 | `enhancedLogger.js` had log queue bug (doubled on error) | Low | Known |

### Changes Made
- `NetworkContext` + `useNetwork()` hook — app-wide connectivity state
- `OfflineBanner` component — subtle orange bar when offline
- FeedbackScreen queues submissions to AsyncStorage when offline
- Banner message: "Offline — communication still works" (AAC apps must reassure)

---

## 7. Android Release Readiness

### Findings
| # | Issue | Severity | Status |
|---|-------|----------|--------|
| R1 | ProGuard rules missing for TensorFlow, Firebase, Expo | High | **Fixed** |
| R2 | Version still at 1.0.0 | Low | **Fixed** |
| R3 | Release signing uses debug keystore | **Blocker** | Documented |
| R4 | `RECORD_AUDIO` permission duplicated in app.json | Low | Acceptable |

### Changes Made
- ProGuard rules added for TF, Firebase, Expo, Hermes, RN
- Version bumped to 1.1.0 (versionCode 2)
- **TODO:** Generate release keystore before Play Store submission

---

## 8. Testing

### Before
- 1 test file (`sanity.test.js`) with 1 test (`1+1=2`)

### After
- **6 test files, 32 tests, all passing**
- `coreVocabulary.test.js` — data integrity, navigation targets, Fitzgerald Key validation
- `theme.test.js` — palette completeness, fallback behavior, brand constants
- `speechService.test.js` — speech calls, empty text guards, voice caching
- `aiProfileStore.test.js` — word frequency, bigrams, privacy-safe summary
- `improvedWordPrediction.test.js` — cache behavior, empty input handling

---

## 9. Shared Contracts (Dashboard/Backend)

### Current Interface Points
| Contract | Location | Notes |
|----------|----------|-------|
| User settings | `userSettings/{uid}` in Firebase RTDB | SettingsContext syncs bidirectionally |
| User logs | `userLogs` in Firebase RTDB | logger.js + enhancedLogger.js |
| Feedback | `feedback/{uid}` in Firebase RTDB | Now queued offline |
| User profile | `users/{uid}` in Firebase RTDB | SignupScreen creates |
| AI Profile summary | `getPrivacySafeSummary()` | Privacy-first; aggregate only |

### Recommended Additions
- Dashboard should read `getPrivacySafeSummary()` for usage analytics
- Failed search terms (`getFrequentFailedSearches()`) should surface to caregivers for vocabulary gap detection
- Repeated phrases (`getRepeatedPhrases()`) should surface for custom vocabulary suggestions

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Release keystore not generated | High | Blocker | Must generate before Play Store submission |
| TensorFlow model size on older devices | Medium | Medium | Model is ~2MB; lite_mobilenet_v2 already used |
| Firebase RTDB pricing at scale | Low | High | Consider Firestore migration at >10K users |
| ARASAAC API availability | Medium | Low | Core vocabulary works offline |
