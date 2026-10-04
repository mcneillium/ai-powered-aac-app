# Voice development team

This repository is the Voice AAC app. Before work verify repository root, remote, branch and working tree. Preserve unrelated local work and obey all applicable permissions and hooks.

For coordinated development and testing read docs/agent-team/PLAYBOOK.md. The project specialists are in .claude/agents/. The main conversation coordinates them; use /voice-team to start the workflow. Definitions are reusable instructions, not permanently running services or a guarantee of expertise.

Inspect package.json, lockfile, current CI and source before selecting commands. README contains historical claims: verify against implementation. Read docs/transformation/BRIEF.md and STATUS.md if present, plus docs/release/device-test-checklist.md when testing devices. Do not block if optional historical docs are missing; report what is unavailable.

Preserve AAC user control, offline communication, learned positions, speech cancellation, saved data and optional learning consent. Never put real sentences, photos, credentials or signing secrets in Git or reports.

Workers do not commit/push; the coordinator integrates and may create draft PRs when authorised. Never merge or release without explicit instruction. Respect guards; a different tool is not a way around a denied action.

## Test APK builds (owner preference, 2026-10-04)
- Save every completed Voice APK build in `C:\Users\McNei\OneDrive\AAC`:
  - `Builds\YYYY-MM-DD_<commit>\`: the extracted APK (never only inside a ZIP), `SHA256SUMS.txt` and a concise `BUILD-NOTES.md` covering the source commit, app name, package, version, signing-certificate fingerprint, install steps, and the tests performed and not performed.
  - `Latest\`: a copy of the newest **verified** test APK with its checksum and matching notes. Update it only after the new build is verified; never label an untested build as tested.
- Verify the SHA-256 after every copy, and remove an original only after verification succeeds. Preserve older builds and unrelated files (for example `App APK\`).
- Keep source checkouts, temporary build files, signing keys and credentials outside that folder.
- Do not claim OneDrive has finished syncing unless it has been verified.
