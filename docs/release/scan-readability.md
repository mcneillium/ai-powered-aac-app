# Scan-control readability follow-up

Scope: Studio board and compact Classic board. Based on branding revision
3c240ba plus the Classic-label fixes from 0ca930d and f2c94df (cherry-picked
without modification). The noncompact Classic scan bar is unchanged.

Changes:
- Equal-width scan actions use icons and full wrapping labels without shrinking.
- The short visible Stop label retains its full accessible name.
- Auto scan has a visible Select action on compact Classic as well as Studio.
- Measured toolbar height supplies scroll clearance and speech-notice offset.
- Bottom-positioned Studio speech controls stay below the scan toolbar.
- Vocabulary data, column count and grid origin are unchanged by these edits.

Validation on the final source tree (2026-10-04 UTC):
- npm run lint: exit 0, zero errors and 15 existing warnings.
- npx jest --runInBand --no-coverage --forceExit: exit 0, 79 suites / 960 tests.
- npx expo config --type public: exit 0.
- npx expo export --platform android: exit 0.
- git diff --check: exit 0.
- Independent read-only review: no remaining blockers after resolving bottom
  composer overlap.
- Three board integration tests fail when the original board files are restored;
  all six new component/integration tests pass with these changes. They verify
  action routing, labels and measured-layout propagation, not native glyph fit.

Local command outputs: native-ui-evidence/scan-readability/ (ignored).
No new APK was built: this workspace has no Android SDK/device or the existing
phone-test signing key. No phone/emulator, listening, TalkBack, physical switch
or iOS testing was performed. Existing APKs do not contain this follow-up.

Device acceptance still required:
1. At 320dp-equivalent width and maximum system/app text sizes, check Stop,
   Next and Select in auto/step modes, English and Spanish.
2. Scroll the last grid row fully above the toolbar in Studio and compact Classic.
3. Repeat with Studio controls at the bottom. Speech tools and suggestions must
   remain reachable; starting/stopping scan must not shift the first grid row.
4. Verify TalkBack names/actions and actual switch selection/stop behaviour.
5. Rotate while scanning; check resized toolbar clearance and speech notices.
