# Decision ledger — overnight run 2026-08-08

Append-only. Every non-trivial choice, with the reasoning and the alternatives
rejected. Format per OVERNIGHT-RUN.md §0.6.

---

### D-001 — [Phase 0] Preserved both dirty working trees on a WIP branch before branching
- **Decision:** Committed the uncommitted state of both repos onto
  `overnight/2026-08-08/pre-existing-wip` (app `7415345`, dashboard `a7bec76`),
  then created `overnight/2026-08-08/improvements` from that commit in each, so
  the pre-existing work carries forward rather than being stranded.
- **Why:** §0.A.1 requires nothing of Paul's is lost. The app tree had a
  `functions/package-lock.json` edit and two untracked docs; the dashboard had a
  modified hosting cache. All trivial, but "trivial" is a judgement I do not get
  to make about someone else's uncommitted work at 22:34 with nobody to ask.
- **Alternatives rejected:** (a) `git stash` — invisible, easy to lose, and does
  not survive a branch mistake. (b) Branch `improvements` from `master` and leave
  the WIP only on the side branch — safe for the WIP but silently drops the
  `path-to-regexp` lockfile reconciliation from everything built tonight.
- **Blast radius:** Repository state only. `master`/`main` untouched in both.
- **Reversible:** Yes. `git reset --hard 7079c09` (app) / `18967d3` (dashboard).
- **Confidence:** High.

### D-002 — [Phase 0] Created the `commai-aac` skill rather than referencing a skill that does not exist
- **Decision:** `.claude/skills/` did not exist in either repo, so the
  `skills: [commai-aac]` preload that §0.C requires of every agent had nothing to
  resolve to. Wrote `.claude/skills/commai-aac/SKILL.md` — the two repos, the
  three-tier pipeline, the shared data contract, the AAC non-negotiables, and the
  build gotchas — and kept the frontmatter reference as specified.
- **Why:** §0.C says to verify the name and note the correction. The correction
  here is that the skill was missing entirely. Writing it is strictly better than
  dropping the preload: it is the mechanism by which §9's "leave the fleet
  smarter than you found it" actually works.
- **Alternatives rejected:** (a) Omit `skills:` from every agent — loses the
  shared context that stops eleven agents each rediscovering the same facts.
  (b) Point at a different existing skill — none exists.
- **Blast radius:** Isolated. New files under `.claude/`; no runtime code.
- **Reversible:** Yes, delete the directory.
- **Confidence:** High.

### D-003 — [Phase 1] Root-caused the versionCode 19 Metro failure to a missing module, not environment drift
- **Decision:** Recorded the release blocker as **already fixed at HEAD** by
  commit `194a416`, with the root cause being unresolvable relative imports in
  the production module graph — specifically `src/screens/LoginScreen.js`
  importing `../utils/logger`, a file that never existed on that branch (the real
  module is `../utils/enhancedLogger`). `src/hooks/useOnDevicePrediction.js`
  carried a second instance, importing `../../assets/tf_model/model.json` and
  `…/group1-shard1of1.bin` when the real paths are under
  `assets/tf_model/word_prediction_tfjs/`.
- **Why:** Evidence, in order of strength. (1) A worktree at `b8e817f` — the last
  commit before the August work, i.e. the tree versionCode 19 was built from —
  fails a production Metro bundle in 7.5s with
  `Unable to resolve module ../utils/logger from …\src\screens\LoginScreen.js`.
  (2) That bundle ran against the **current, healthy, reconciled** `node_modules`
  via a filesystem junction, which is what disproves the previous session's
  drift hypothesis: the drift is gone and the April tree still fails. (3)
  `App.js:37` imports `LoginScreen`, so it is in the production graph — not dead
  code Metro could skip. (4) HEAD bundles clean at 7.15 MB. (5) The config diff
  across the same range is empty, so Babel/Metro/Expo config cannot be
  implicated. (6) `npm ci --dry-run` is clean, so a failed container install
  cannot be implicated.
- **Alternatives rejected:** (a) The previous session's `node_modules`
  reconciliation hypothesis — actively disproven, see (2); leaving it standing
  would send the next investigator down a dead end. (b) Case sensitivity — the
  sweep is clean at HEAD and the April failure is a missing file, not a mis-cased
  one. (c) Lockfile/transitive drift — no config change, lockfile in sync.
  (d) `git bisect` — unnecessary once a 7-second static check localises it.
- **Blast radius:** None. No code change; the fix already shipped in `194a416`.
  What changes is the *documentation* and the addition of a permanent gate.
- **Reversible:** N/A (analysis).
- **Confidence:** High for the root cause of the April tree's failure. **Medium**
  for "this is precisely what versionCode 19 hit" — no one captured the original
  EAS error text, so the identification rests on the tree being the same one and
  the failure being deterministic and at the right stage. Nothing else in that
  tree can fail a Metro bundle before this does.

### D-004 — [Phase 0] Accepted that the safety hook is inert this session and compensated manually
- **Decision:** Wrote `.claude/hooks/guard.mjs`, registered it as a `PreToolUse`
  hook for `Bash` in `.claude/settings.json`, unit-tested all ten rules against
  fifteen commands (every block and every allow correct) — then confirmed by live
  test that it does **not** intercept commands in the already-running session.
  Recorded in `RISKS.md`; proceeding with the guardrails enforced by discipline
  rather than by machine for the rest of tonight.
- **Why:** Claude Code captures hook configuration at session start, so a hook
  registered mid-session cannot take effect until restart. §0.D anticipates this
  exact outcome and says to log it loudly and proceed with heightened care rather
  than abort. Restarting the session to activate it would cost the entire run.
- **Alternatives rejected:** (a) Claim the hook is protecting the run — false,
  and a false safety claim is worse than a documented absence of one. (b) Abandon
  the hook — it is still the right artefact; it protects every future session
  including Paul's own.
- **Blast radius:** Isolated (new files under `.claude/`). It will start
  enforcing on Paul's next Claude Code start, which he should know about; noted
  in `HANDOVER.md`.
- **Reversible:** Yes — delete `.claude/settings.json` and `.claude/hooks/`.
- **Confidence:** High.

### D-005 — [Phase 0] Gated the pre-existing failures on "not worse", and pinned `CI=1` for expo-doctor
- **Decision:** `scripts/gates.mjs` compares lint warnings, test count,
  expo-doctor failures and `npm ls` invalid resolutions against
  `scripts/gates.baseline.json` rather than against zero. Bundle success and
  import-case cleanliness are absolute. Bundle *size* is reported, never enforced.
- **Why:** §0.8 asks for exactly this for lint. Extending it to the dependency
  tree is the same argument: `.npmrc` sets `legacy-peer-deps=true` and
  `@tensorflow/tfjs-react-native` declares peers it cannot satisfy on Expo 54, so
  four invalid resolutions are the *correct* steady state and gating on zero
  would mean gating on a TF.js major bump that §0.2 forbids. Bundle size is left
  unenforced deliberately: an accessibility affordance that costs 6% of the
  bundle is a trade Paul should make, not one a gate should silently veto (§0.3).
- **Subtlety worth recording:** `npx expo-doctor` reports *1 check failed* (eight
  packages drifted from the SDK 54 pins) but `CI=1 npx expo-doctor` reports
  *18/18 passed*. Same tree, same command, different answer. The gate pins
  `CI=1` for determinism and takes the stricter baseline of **0** under those
  conditions, so any new failure trips it. The version drift itself is a real
  finding and goes to the backlog rather than being lost inside a green gate.
- **Alternatives rejected:** (a) Gate everything on zero — turns the suite red on
  arrival, which trains everyone to ignore it. (b) Drop the failing gates — loses
  the regression signal, which is the entire value. (c) Enforce a bundle-size
  ceiling — would let a byte count veto an accessibility fix.
- **Blast radius:** Isolated; tooling only.
- **Reversible:** Yes.
- **Confidence:** High.
