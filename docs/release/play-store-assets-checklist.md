# Play Store Assets Checklist

All assets required for Google Play Store submission.

## Required Graphics

### App Icon (High-res)
- **Dimensions:** 512 x 512 px
- **Format:** 32-bit PNG (with alpha)
- **Source file:** `assets/icon.png`
- **Status:** Exists in repo — verify it meets 512x512 requirement
- [ ] Verify 512x512 resolution
- [ ] Verify no transparency issues on Play Store background

### Feature Graphic
- **Dimensions:** 1024 x 500 px
- **Format:** JPEG or 24-bit PNG (no alpha)
- **Purpose:** Shown at top of Play Store listing
- **Content suggestion:** CommAI logo + "Communication for everyone" tagline + screenshot of AAC board in use
- [ ] **CREATE:** Feature graphic does not exist yet

### Screenshots — Phone
- **Required:** Minimum 2, maximum 8
- **Dimensions:** Min 320px, max 3840px per side. 16:9 or 9:16 aspect ratio.
- **Recommended:** Capture at 1080x1920 (portrait)
- [ ] **CAPTURE:** AAC Board with words in sentence bar
- [ ] **CAPTURE:** AI suggestions strip visible with word predictions
- [ ] **CAPTURE:** Emotion screen with an emotion selected
- [ ] **CAPTURE:** Settings screen showing theme and AI personalisation options
- [ ] **CAPTURE:** Onboarding first slide
- [ ] **OPTIONAL:** Sentence builder with pictograms
- [ ] **OPTIONAL:** Dark theme / High contrast mode

### Screenshots — 7-inch Tablet (if applicable)
- Same requirements as phone
- [ ] Determine if tablet screenshots are needed (app supports tablets)

### Screenshots — 10-inch Tablet (if applicable)
- [ ] Determine if needed

---

## Required Text

### App Name
- **Max:** 30 characters
- **Value:** `CommAI`
- [x] Set in app.json and strings.xml

### Short Description
- **Max:** 80 characters
- **Value:** `AAC communication app with AI-powered word predictions. Works offline.`
- [x] Drafted in play-store-listing-draft.md

### Full Description
- **Max:** 4,000 characters
- [x] Drafted in play-store-listing-draft.md

### Release Notes (What's New)
- **Max:** 500 characters
- [x] Drafted in play-store-listing-draft.md

---

## Required URLs & Policies

### Privacy Policy URL
- **Required:** Yes (mandatory for all apps)
- **Current status:** Placeholder in `brand.privacyPolicyUrl`
- [ ] **BLOCKER:** Host privacy policy at a public URL
- [ ] Update `brand.privacyPolicyUrl` in `src/theme.js`
- [ ] Enter URL in Play Console → Store Listing → Privacy Policy

### Support Email
- **Required:** Yes
- **Current status:** Placeholder in `brand.supportEmail`
- [ ] Replace placeholder in `src/theme.js`

### Website (optional)
- [ ] If available, add to Play Console listing

---

## Required Forms

### Content Rating
- [ ] Complete IARC questionnaire in Play Console
- **Expected rating:** Everyone
- **Content descriptors:** None expected (no violence, gambling, user-generated content sharing)

### Data Safety
- [x] Draft prepared in `docs/release/data-safety-draft.md`
- [ ] Enter responses in Play Console → Data Safety section

### Target Audience
- [ ] Declare in Play Console
- **Primary:** People who use AAC for communication
- **Note:** If declaring "children" as target audience, must comply with Families Policy

### App Category
- **Recommended:** Medical or Education
- [ ] Select in Play Console

---

## Recommended (Not Required)

### Promo Video
- **Format:** YouTube URL
- **Max length:** 30 seconds recommended
- [ ] Optional: Create a short demo video

### Promo Graphic (Legacy)
- 180 x 120 px — only used on very old Android versions
- [ ] Skip unless targeting legacy devices

---

## Asset Production Workflow

1. Install app on a device or emulator at 1080x1920
2. Navigate through each screen and capture screenshots via `adb shell screencap`
3. Create feature graphic in Figma/Canva using brand colors (#4CAF50, #2196F3)
4. Export all assets as PNG
5. Upload to Google Play Console → Store Listing
