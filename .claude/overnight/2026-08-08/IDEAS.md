# Ideas — 2026-08-08

Product thinking, not maintenance. Each entry: what it is, why it matters *for
AAC users specifically*, effort, dependencies, risks, and whether it is
differentiating or table-stakes for an AAC product in 2026.

Effort is in developer-days for one person who knows this codebase.

A note on the framing. "Table-stakes" is not a euphemism for unimportant — it
means a competitor already has it and a clinician will notice its absence during
an assessment. Several of the table-stakes items below outrank every
differentiating one on user impact.

---

## Communication effectiveness

**1. Whole-utterance prediction, not just next-word.** Predict the rest of the
sentence from the first two symbols and offer it as one tap. *Why:* the unit of
AAC effort is the utterance, not the word; a user at 8 wpm saying "I want a
drink please" spends 40 seconds on a sentence a speaking person says in one.
*Effort:* 5d. *Depends on:* B-10 (the current model predicts nothing usable).
*Risk:* a wrong whole-utterance suggestion costs more to reject than a wrong
word. *Table-stakes.*

**2. Phrase banks per situation.** Pre-built sets for GP appointment, ordering
food, school register, bus. Openable in two taps from the board.
*Why:* the highest-frequency AAC contexts are known in advance, and a
non-speaking person in a GP waiting room should not be composing "I have a pain
here" letter by letter. `contextPacks.js` is already the skeleton for this.
*Effort:* 3d. *Risk:* none material. *Table-stakes.*

**3. Context-aware ranking — time of day, place, calendar.** Boost "breakfast"
at 8am, "bus" near a known stop. *Why:* AAC vocabulary need is far more
predictable from context than from word history. *Effort:* 6d. *Depends on:*
B-11 (instrumentation), a location permission and a very careful privacy story.
*Risk:* location data about a vulnerable person is a serious liability; do it
on-device or not at all. *Differentiating.*

**4. Repair strategies as a first-class flow.** Beyond the Quick Repair phrases:
a "let me rephrase" that keeps the failed utterance visible while the user
builds an alternative, so the listener can see both. *Why:* communication
breakdown is the defining experience of AAC use and repair is the skill SLTs
spend most time teaching. *Effort:* 4d. *Differentiating.*

**5. Conversation partner display.** A second view — same device turned around,
or a paired phone — showing the utterance *as it is being built*.
*Why:* the awkward silence while an AAC user composes is what makes listeners
walk away. Showing progress converts dead air into visible turn-taking.
`DisplayMode.js` is half of this already. *Effort:* 4d local, 10d paired.
*Differentiating.*

**6. Fringe vocabulary acquisition.** Detect that a user repeatedly reaches for
a word they do not have and offer to add it. *Why:* `vocabRequests/{uid}` already
records exactly this — words searched and not found — and nothing consumes it.
That node is a list of things this person wanted to say and could not.
*Effort:* 2d. *Table-stakes, and nearly free.*

**7. Rate enhancement metrics.** Words per minute and keystroke savings.
*Why:* these are the measures AAC intervention is clinically evaluated on, and
the system collects neither, so nobody can answer "is this working?".
**Prototyped tonight** — see `src/services/rateMetrics.js`. *Effort:* 1d to
wire up. *Table-stakes.*

**8. Word-by-word utterance editing on the main board.** Tap any word in the
sentence bar to remove or replace it. *Why:* fixing word 2 of 7 currently costs
five deletions of correct words. *Effort:* 1d. Already in the backlog as B-8.
*Table-stakes.*

**9. Abbreviation expansion.** "brb" → "I'll be right back", user-defined.
*Why:* classic rate enhancement, works for literate users, costs almost nothing.
*Effort:* 2d. *Table-stakes.*

---

## Autonomy and dignity

**10. Voice banking and age/gender-appropriate voice choice.** *Why:* a
fourteen-year-old boy given a default female adult voice is being misrepresented
every time he speaks. Voice is identity, not a setting. `voicePresets` covers
prosody but not voice selection. *Effort:* 3d for system-voice selection; voice
banking is a partner integration. *Table-stakes* for selection,
*differentiating* for banking.

**11. Private mode — an utterance that is never logged.** A toggle that speaks
without recording anything, anywhere. *Why:* the user is entitled to say
something their caregiver does not get to read later. Everything else in this
product assumes the caregiver's view is benign; this one does not have to.
*Effort:* 1d. *Differentiating, and a genuine trust signal.*

**12. User-facing history and deletion.** The user can see and delete their own
utterance history from the app. *Why:* today a caregiver can export a CSV of
someone's communication in one click, and that person has no way to see or
remove any of it. The asymmetry is the finding. *Effort:* 2d. Related: SEC-H12.
*Table-stakes.*

**13. Emergency phrases in one tap from any board state.** "I need help now",
"I am in pain", "Call my mum" — reachable without navigation, without composing.
*Why:* the current QuickRepair FAB is close but its contents are conversational
repair, not emergency. *Effort:* 1d. *Table-stakes.*

**14. A visible indicator that a caregiver is linked.** Persistent, in the app,
naming who. *Why:* a caregiver can currently attach themselves to a user's
account with no notification and no consent (SEC-C4). Even after that is fixed,
the person being monitored should be able to see that they are. *Effort:* 1d.
*Table-stakes for a safeguarding-sensitive product.*

---

## Reliability

**15. Crash-safe utterance recovery.** Persist the in-progress sentence; restore
it on relaunch. *Why:* composing takes minutes; a low-memory kill mid-sentence
loses what someone was in the middle of saying. **Prototyped tonight** —
`src/services/utteranceRecovery.js`. *Effort:* 0.5d to wire up. *Table-stakes.*

**16. Full offline parity with an honest indicator.** *Why:* mostly true already
(`OfflineBanner` is honest, the board is local), but the Vertex call fires
regardless of connectivity and can burn 10s on a captive portal. *Effort:* 1d.
*Table-stakes.*

**17. Encrypted backup and one-tap restore of the entire vocabulary.**
*Why:* a personalised AAC vocabulary represents months of a user's and a
clinician's work. Losing it to a broken device is a catastrophic event, and
there is currently no export at all. *Effort:* 4d. *Table-stakes.*

**18. Multi-device conflict resolution for vocabulary edits.**
*Why:* `customVocabStore.mergeRemote` already implements delete-wins tombstones
and has **zero tests**. It is the most data-integrity-sensitive code in the app.
*Effort:* 2d for the tests, 3d for a better merge. *Table-stakes.*

**19. Symbol cache on disk with a bounded LRU.** *Why:* ARASAAC is fetched fresh
every time with no cache of any kind, so a symbol seen a hundred times is still
unavailable offline. *Effort:* 2d. *Table-stakes.*

---

## Clinical and caregiver value

**20. Never-used vocabulary report.** Which buttons has this user never once
pressed? *Why:* dead buttons are pure cognitive load on every scan and every
visual search. Surfacing them is one of the most actionable things you can hand
an SLT, and the data already exists. *Effort:* 2d. *Differentiating.*

**21. Core-vs-fringe ratio over time.** *Why:* a standard clinical measure of
AAC development. Rising fringe use with stable core use is the signature of a
user whose language is growing. *Effort:* 2d. *Differentiating.*

**22. Goal tracking against SLT targets.** "Use 3 different verbs this week."
*Why:* it connects the app to the therapy plan, which is what makes a clinician
recommend it. *Effort:* 6d. *Differentiating.*

**23. Exportable session reports (PDF/CSV) for clinical review.**
*Why:* SLTs write reports; if the data cannot leave the dashboard it does not
reach the review. *Effort:* 3d. *Table-stakes.*

**24. Consent-aware analytics.** Nothing is shown to a caregiver that the user
has not been told is collected. *Why:* the lawful basis for monitoring a
vulnerable adult's communication is not obvious, and there is currently no
consent step anywhere (SEC-H13). *Effort:* 3d plus a policy decision.
*Table-stakes.*

**25. Alert producer.** The dashboard has an entire alerts UI and **nothing
writes alerts** — a distress signal can never reach a caregiver. Either build
the producer or remove the UI. *Effort:* 3d. *Table-stakes.*

---

## Platform and quality

**26. Automated accessibility regression testing in CI.** Contrast is now
computed in a test (`themeContrast.test.js`); extend to touch-target sizes and
required accessibility props, both mechanically checkable from the source.
*Effort:* 3d. *Differentiating — very few apps do this.*

**27. Privacy-safe crash reporting by construction.** An error reporter whose
API cannot accept a string that might be utterance content. *Effort:* 2d.
*Table-stakes.*

**28. Feature flag infrastructure.** **Built tonight** —
`src/config/featureFlags.js`. Deliberately local-only: a flag that could change
underneath a user is a liability in a device someone speaks with. *Effort:* done.

**29. Internationalisation and multi-language symbol sets.** `i18n/strings.js`
exists but is English-only. *Why:* ARASAAC is a Spanish project with excellent
multilingual coverage; the symbols are already there. *Effort:* 5d.
*Table-stakes outside the UK.*

**30. Play Store readiness.** Data-safety declaration matching what the app
actually sends (utterances go to Vertex), an accessibility statement, target SDK
compliance. *Effort:* 2d. *Table-stakes.*

**31. A debug screen for dev builds** showing tier routing, latency, cache hit
rate and queue depth. *Why:* every finding in the AI audit is a hypothesis about
behaviour nobody is watching. *Effort:* 2d.

---

## AI/ML

**32. On-device personalisation that never leaves the device.** *Why:* the
strongest possible privacy story for a product handling this data, and a real
differentiator against cloud-first competitors. *Depends on:* B-10 — the current
on-device fine-tuning trains the model to predict `<UNK>` for 71% of the
vocabulary. *Effort:* 8d. *Differentiating.*

**33. Prediction acceptance rate as a first-class metric feeding ranking.**
*Why:* it is the only measure of whether the AI is helping, it is cheap, and the
current implementation can report over 100% because the numerator and
denominator count different things. *Effort:* 2d. Backlog B-9. *Table-stakes.*

**34. Negative signal — "don't suggest this again".** *Why:* the profile has no
way to represent a rejected suggestion, so a word the user refuses twenty times
keeps appearing in the same slot. Each strip render already gives 4–8 implicit
negatives for free. *Effort:* 2d. *Table-stakes.*

**35. Semantic symbol search across OpenMoji, Mulberry and ARASAAC.**
*Why:* a caregiver adding a word needs the right symbol in seconds, not a
keyword-match trawl. *Effort:* 5d. *Differentiating.*

**36. Confidence calibration and a "why this suggestion" view for caregivers.**
*Why:* `scoreWithExplanation` already produces a reason string that the board
shows as a tiny label. Surfacing it properly builds clinician trust in the AI —
and the audit found the current confidence numbers are double-softmaxed and not
probabilities at all, which anything confidence-gated would silently inherit.
*Effort:* 3d. *Differentiating.*

---

## The three built tonight — all flag-off

| Flag | Module | What it enables |
|---|---|---|
| `utteranceRecovery` | `src/services/utteranceRecovery.js` | In-progress sentence survives a crash or low-memory kill |
| `rateMetrics` | `src/services/rateMetrics.js` | Words-per-minute and keystroke-savings tracking |
| `activationLockout` | `src/services/activationGuard.js` | Post-activation window so a tremor cannot double-fire a word |

**How to turn one on:** set it to `true` in `FEATURE_FLAG_DEFAULTS` in
`src/config/featureFlags.js` and rebuild, or call
`setFeatureFlag('name', true)` from a dev build. There is no persistence and no
remote config, on purpose: a flag that changes underneath the user is a
liability in a device someone speaks with.

**None is wired into a screen.** They are tested, self-contained modules with no
call sites — so turning a flag on today changes nothing. That is deliberate: each
needs a device test on the communication surface before it touches a tap, and I
could not do that from here. Wiring is a 0.5–1d job each.

### How to evaluate them

**`utteranceRecovery`** — force-kill the app mid-sentence and relaunch. Success
is the sentence returning intact and the 30-minute expiry discarding a stale
one. Watch for the opposite failure: a draft restored into a *new* conversation
is worse than no draft at all, which is why the TTL exists. Reject it if
restoration ever surprises the user.

**`rateMetrics`** — run it for a fortnight on one consenting user and check
whether the WPM curve moves when you change something you believe helps. If the
number does not respond to interventions you know are real, the metric is not
measuring what you think. Keep it only if an SLT says the numbers match their
clinical judgement.

**`activationLockout`** — needs a user with a tremor, not a simulation. Success
is fewer duplicated words with **no** rejected deliberate presses. The failure
mode to watch for is the dangerous one: a user who genuinely wants "no no no"
being told they cannot. Start at 350ms per-target, and if you find yourself
raising it much above 500ms, the answer is probably dwell-to-select rather than
a longer lockout.
