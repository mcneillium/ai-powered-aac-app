# Firebase rules tests (local emulators only)

Behaviour tests for `database.rules.json` and `storage.rules`. They cover every
Rules Playground case in `docs/release/deployment-checklist.md` (§1a, §1b) plus
the data shapes the app writes (logs, the sync summary, Voice 2 settings,
custom words, `userSync`), so a rules change that would reject the app's own
data fails here first.

```bash
npm run test:rules
```

- Starts the Realtime Database and Storage emulators for the project
  `demo-voice-rules`. A `demo-` project is local-only: nothing reaches a real
  Firebase project, no login or credentials are used, and nothing is deployed.
- Needs **Java 21 or later** (the Firebase CLI's emulator requirement). The CLI
  version is pinned in the script and fetched with `npx` only when you run it.
- The tests refuse to run unless the emulator host variables point at
  `127.0.0.1`/`localhost`, so running them by accident against anything else
  fails before a single request.
- CI runs them in the "Firebase rules (local emulators)" job.
- Not part of `npm test`: the app's Jest setup never picks up `*.emulator.js`.
