# Native test APK fallback

`.github/workflows/android-test-apk.yml` builds on pushes to `codex/voice-release-readiness`. Manual dispatch is also limited to that branch. It uses a clean checkout of the event's exact source SHA, locked npm dependencies, Java 17, Android SDK 36 and a clean Expo Android prebuild. The existing release-signing guard remains enabled; no debug-signing bypass or production bundle is requested.

The app name is **Voice Visual Test <short-commit>**, with package `com.elpabloawakens.aipoweredaacapp.prtest<first-12-commit-characters>r<run-id>a<run-attempt>`. The APK includes arm64-v8a and x86_64. A newly generated test key lives only in runner temporary storage. No account, signing or cloud secrets are required or uploaded. Firebase accounts, sync and cloud AI have no configuration; explicit ARASAAC searches remain online functionality.

Before upload, the job verifies the actual APK's Android signature, package, app name, both native architectures, allowed release permissions and embedded JavaScript bundle. It uploads only the extracted APK, `SHA256SUMS.txt` and `BUILD-NOTES.md`, retained for 14 days. A successful build is **build evidence**, not installation or device acceptance. The separate lint/test/export CI result must also be checked for the same source SHA.

Download the artifact from the successful Actions run and extract it into `C:\Users\McNei\OneDrive\AAC\Builds\YYYY-MM-DD_<commit>\`. Verify the checksum after extracting and after any copy. Keep older builds and unrelated folders. Update `Latest` only after the new APK passes device testing. Actions cannot verify that this Windows folder exists or that OneDrive has synced.

Install by opening the extracted APK on Android, or use `adb install -r <APK>`. Each build attempt has a different test package and temporary signing key, so even repeated builds of the same commit install alongside earlier attempts. Stop on any signature conflict; never uninstall to work around it, because that deletes data.

The job is bounded to 60 minutes and cancels older unfinished builds on the same branch. It does not merge a PR, change Firebase, call EAS, publish to a store or install on any phone/emulator. If it fails, its Actions logs are the failure evidence; no passing APK artifact is uploaded.

Workflow creation and static validation do not establish that a native build ran. Record the actual run URL, source SHA and outcome in the current release report after publication and completion.
