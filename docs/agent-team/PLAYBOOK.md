# Voice agent team

## Start

Run Claude Code in the Voice repository on a branch containing these files, then invoke /voice-team with a concrete goal. If the command is unavailable, ask the main session to read this file and coordinate the named agents. Check installed Claude Code supports project subagents. Respect existing local .claude files; never overwrite settings or hooks during setup.

These are development agents, not agents embedded in the shipped app. They run only inside an active Claude session with its available tools and permissions. They cannot access a phone merely because this setup exists.

## Specialist workflows

| Agent | Responsibility |
|---|---|
| voice-design | UI implementation, visual inspection, AAC interaction and accessibility targets |
| voice-engineer | App behaviour, offline operation, speech, migrations and regressions |
| voice-prediction | Local learning, prediction correctness and held-out evaluation |
| voice-native-qa | Automated checks, reproducible native builds, emulator/device evidence |
| voice-privacy | Independent read-only data-flow, consent and licensing review |
| voice-reviewer | Independent read-only review of code and evidence |

The main session is the coordinator. Specialist instructions encode reusable skills and workflows; they do not grant tools, credentials, professional qualifications or background execution.

## Coordinator procedure

1. Verify root, remote, exact source revision, working-tree changes, instructions and current PR state. Do not hardcode old commit IDs as current truth. Inspect scripts and CI to identify supported commands.
2. Read relevant existing audit/checklist/brief. Establish a small task list with acceptance checks. Capture baseline failures and screenshots if changing UI. Do not repeat completed investigations without reason.
3. Assign bounded tasks with exact file ownership, acceptance criteria and evidence location. At most three concurrent workers by default; use fewer if memory/build resources are constrained. Only one worker may own an emulator/device at a time. Avoid simultaneous installs and Gradle builds.
4. Integrate coherent changes. Reproduce defects before fixes where feasible. Preserve user data and familiar vocabulary positions. Do not weaken tests to obtain green status. Verify independent findings.
5. Run targeted checks after changes and the existing full gate once on the final integrated state. Current observed package scripts include npm run lint and npm test; verify again. Android export is npx expo export --platform android. Discover build and native automation scripts instead of inventing them.
6. Have voice-reviewer inspect the raw final diff and evidence, and voice-privacy inspect changes to storage, networking, models or assets. Resolve blocking findings and repeat only affected checks.
7. Build a test APK from a clean checkout of the final committed source when Android tooling exists. Record source SHA, build configuration, package identity, signing certificate fingerprint and SHA-256. Keep signing secrets outside Git. Never uninstall an existing app to work around signature mismatch. Use a separate test identity if necessary.
8. Coordinator may commit verified work and push a feature branch/open a draft PR when authorised. No force-push, merge, production deploy or release. Do not circumvent a hook via another tool.
9. Finish with changed behaviour, screenshots where relevant, exact checks/results, APK location, commit/PR and remaining human checks. Never imply all tests passed when a gate failed or was not run.

## Evidence and memory

Keep a concise docs/agent-team/STATUS.md during actual runs: goal, revision, decisions, completed checks with dates, reproducible failures, next action and blockers. Keep machine outputs under the repository's existing ignored evidence directory, or a task-specific ignored directory. Commit only small sanitised summaries and necessary fixtures. Never commit private messages, production logs or secrets. Do not create a passing status template before running checks.

Every result must identify its level: static review, unit/integration, browser, emulator, physical device, or human evaluation. Include actual command/exit result and artifact path where appropriate. Old results become stale after relevant changes.

## Native coverage

Exercise Child/Adult modes, suggestion selection, Clear/Undo, Stop and rapid taps, long text, no voice, offline startup, camera/gallery denial, saved data after upgrade, live font changes, safe areas, fixed tile bounds, learning opt-in/pause/reset and delayed-write deletion races. Read the current release checklist to determine what section G actually contains.

Use a connected authorised phone only. Specify its adb serial. Tell the user the short required action if USB authorisation is missing. Emulator results are not phone results. For personal device changes record original settings and restore them where possible. Do not use production AI endpoints or real communication fixtures.

Human listening, real TalkBack/VoiceOver navigation and physical switch usability cannot be certified from screenshots or mocked speech calls. Automate what tools support, then provide only the remaining concise human checklist. iOS requires available appropriate tooling; otherwise mark it not tested.

## Limits and recovery

Do not run endless self-improvement or retry loops. After two unsuccessful attempts at the same blocked operation, document the blocker and move to unaffected work. Checkpoint before context exhaustion. Agents do not run after the session terminates unless a separate explicitly configured runner exists. No runner or schedule is installed by this PR.

Sources for configuration format: https://code.claude.com/docs/en/sub-agents and https://code.claude.com/docs/en/skills (checked 2026-10-04). Runtime discovery must be verified in the user's installed Claude Code; static definition validation is not a runtime test.
