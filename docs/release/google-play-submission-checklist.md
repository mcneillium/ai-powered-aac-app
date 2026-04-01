# Google Play Store Submission Checklist — Voice v1.1.0

**Updated:** 2026-03-23

## Completed

- [x] App name: "Voice"
- [x] Package: `com.elpabloawakens.aipoweredaacapp`
- [x] Version: 1.1.0
- [x] EAS production profile configured (AAB, remote credentials, auto-increment)
- [x] Release signing: hard-fails without production keystore
- [x] `.gitignore` excludes keystores, service accounts
- [x] Privacy policy URL set: `https://paulmartinmcneill.com/commai/privacy-policy`
- [x] Support email set: `support@paulmartinmcneill.com`
- [x] Privacy policy link wired in Settings screen
- [x] App icon (Voice-branded, 512x512 + 1024x1024)
- [x] Adaptive icon (foreground + teal background)
- [x] Feature graphic (1024x500, Voice-branded)
- [x] Short description drafted
- [x] Full description drafted
- [x] Release notes drafted
- [x] Data safety draft prepared
- [x] Screenshot templates + compositing workflow ready
- [x] 36 tests passing
- [x] All palette/theme values updated for Voice brand

## TODO — Human actions

- [ ] **Run Voice-branded EAS build:** `npx eas build --profile production --platform android`
- [ ] **Capture 4 screenshots** from device/emulator (see `final-screenshot-capture-guide.md`)
- [ ] **Generate final screenshots:** `python3 scripts/composite-screenshots.py`
- [ ] **Upload AAB** to Play Console
- [ ] **Upload feature graphic** from `assets/branding/google-play/feature-graphic/`
- [ ] **Upload final screenshots** from `assets/branding/google-play/screenshots/final-*.png`
- [ ] **Paste listing text** from `docs/release/play-store-listing-draft.md`
- [ ] **Complete IARC content rating** (expected: Everyone)
- [ ] **Complete data safety form** (use `docs/release/data-safety-draft.md`)
- [ ] **Set target audience** and app category
- [ ] **Deploy Cloud Function** + set HF token (for image captioning)
- [ ] **Revoke compromised tokens** (HF + Vision)
