# Data Safety Declaration Draft

For the Google Play Data Safety section.

**Updated 2026-08-02** to accurately reflect what the app actually
transmits. The previous draft claimed communication content and photos
never left the device; that was not true of the shipped code and would
have been a policy violation. Cloud AI transmission is disclosed below
and is user-controllable in Settings ("Online suggestions").

## Data Collection Summary

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Optional | No | Account creation and authentication |
| Name | Optional | No | User profile display |
| User interactions | Yes (local) | No | On-device AI personalisation |
| App activity (word usage) | Yes (local) | No | Improve word predictions |
| Sentence context (words in the current sentence, recent phrases) | Yes, when "Online suggestions" is enabled | Processed by Google Vertex AI on our behalf | Generate AI phrase suggestions |
| Photos (user-initiated only) | Yes, when the user takes/picks a photo in Camera | Processed by Google Vertex AI and Hugging Face on our behalf | Image description, OCR, and phrase generation |
| Crash logs | No | No | — |
| Device identifiers | No | No | — |
| Location | No | No | — |
| Financial info | No | No | — |

## Detailed Responses

### Is any data collected or shared?
Yes — the app collects data to provide its core functionality, and sends
limited data to AI processing services when the user uses AI features.

### Data collected

**1. Personal info — Email address**
- Collected: Optional (only if user creates an account)
- Purpose: App functionality (authentication)
- Encrypted in transit: Yes (Firebase Auth uses HTTPS)
- User can request deletion: Yes (in-app account deletion removes auth account and synced data)

**2. Personal info — Name**
- Collected: Optional (during signup)
- Purpose: App functionality (profile display)
- Encrypted in transit: Yes
- User can request deletion: Yes

**3. App activity — In-app interactions (local learning)**
- Collected: Yes
- Purpose: App functionality and personalisation
- Storage: On-device only (AsyncStorage)
- Learned patterns are NOT transmitted to any server
- User can delete this data: Yes (Settings → Reset AI Data)

**4. Communication context — AI suggestions (optional, on by default, user-controllable)**
- When "Online suggestions" is enabled in Settings, the words in the
  user's current sentence and up to 3 recently spoken phrases are sent
  over HTTPS to our Cloud Functions backend, which forwards them to
  Google Vertex AI (Gemini) to generate phrase suggestions.
- No name, email, or account identifier is included in the AI prompt.
  Requests are authenticated with a Firebase token for abuse prevention.
- This content is used only to generate the suggestion response and is
  not stored by the app's backend.
- Turning off "Online suggestions" keeps all sentence content on-device.

**5. Photos — Camera features (explicit user action only)**
- When the user takes or selects a photo in the Camera screen, the image
  is sent over HTTPS to our Cloud Functions backend for processing by
  Google Vertex AI (scene description / OCR) and Hugging Face
  (captioning).
- Photos are processed transiently to produce the response and are not
  stored by the app's backend.
- The camera is never accessed without an explicit user action.

**6. Feedback (optional)**
- If the user submits feedback, the text (plus optional name/email they
  type) is stored in Firebase under their user id.

### Data NOT collected
- Precise or approximate location
- Financial or payment information
- Health or fitness data
- Audio recordings
- Files and documents
- Calendar events
- Contacts
- Device identifiers (AAID, IMEI)
- Browsing or search history

### Data shared with third parties
Image and sentence-context data is processed by Google (Vertex AI) and
Hugging Face acting as data processors for the AI features described
above. No data is sold, and no data is shared for advertising or
analytics purposes.

### Data handling
- Learned communication patterns (word frequencies, bigrams) stay on-device
- Guest usage stays entirely local: settings, vocabulary, and logs are not synced for guests
- Cloud sync of settings/vocabulary requires an account and only covers settings, custom vocabulary, and diagnostic logs (never sentence content)
- Diagnostic logs synced for signed-in users contain event names only (no message content, no email addresses) and are auto-deleted after 30 days
- Users can disable AI personalisation and online suggestions independently in Settings
- Users can reset all learned data in Settings
- Firebase Authentication data is handled by Google Firebase (see Firebase privacy policy)

### Security
- Data encrypted in transit (HTTPS/TLS)
- Local data stored via AsyncStorage (device-encrypted storage on Android)
- AI endpoints require authentication and are rate-limited
- Firebase Realtime Database uses per-user security rules (least privilege)

### Data deletion
- Users can reset AI personalisation data from Settings
- In-app account deletion removes the auth account, all cloud-synced data (settings, vocabulary, logs, sync state), and local user data
- Uninstalling the app removes all local data
- Server-side logs are pruned automatically after 30 days
