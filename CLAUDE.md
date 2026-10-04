# Voice development team

This repository is the Voice AAC app. Before work verify repository root, remote, branch and working tree. Preserve unrelated local work and obey all applicable permissions and hooks.

For coordinated development and testing read docs/agent-team/PLAYBOOK.md. The project specialists are in .claude/agents/. The main conversation coordinates them; use /voice-team to start the workflow. Definitions are reusable instructions, not permanently running services or a guarantee of expertise.

Inspect package.json, lockfile, current CI and source before selecting commands. README contains historical claims: verify against implementation. Read docs/transformation/BRIEF.md and STATUS.md if present, plus docs/release/device-test-checklist.md when testing devices. Do not block if optional historical docs are missing; report what is unavailable.

Preserve AAC user control, offline communication, learned positions, speech cancellation, saved data and optional learning consent. Never put real sentences, photos, credentials or signing secrets in Git or reports.

Workers do not commit/push; the coordinator integrates and may create draft PRs when authorised. Never merge or release without explicit instruction. Respect guards; a different tool is not a way around a denied action.
