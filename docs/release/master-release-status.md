# Master Release Status — Voice v1.1.0

**Date:** 2026-03-23

---

## Mobile App — Voice v1.1.0

### Status: **CONDITIONAL GO**

Condition: Voice-branded EAS build + 4 screenshots

### Build

| Item | Status |
|------|--------|
| Previous build (CommAI brand) | Succeeded — `b3SUx6vPMMNBFteQjM1scg.aab` |
| Voice-branded EAS build | **TODO** — run `npx eas build --profile production --platform android` |

### Brand

| Item | Status |
|------|--------|
| App name → "Voice" | DONE |
| Teal palette (#5BB5B5) | DONE |
| App icon (mic + wordmark) | DONE |
| Adaptive icon (fg + teal bg) | DONE |
| Feature graphic (1024x500) | DONE |
| Screenshot templates + compositing | DONE |
| Play Store listing copy | DONE |

### Remaining (5 human-only items)

| # | Item | Needed for |
|---|------|-----------|
| 1 | EAS production build | Play Console upload |
| 2 | Capture 4 screenshots + composite | Play Console upload |
| 3 | Play Console forms (IARC, data safety) | Submission |
| 4 | Deploy Cloud Function + HF token | Image captioning |
| 5 | Revoke compromised tokens | Security hygiene |

**Zero code changes remain.**
