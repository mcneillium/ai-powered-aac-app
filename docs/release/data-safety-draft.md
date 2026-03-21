# Data Safety Declaration Draft

For the Google Play Data Safety section.

## Data Collection Summary

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Optional | No | Account creation and authentication |
| Name | Optional | No | User profile display |
| User interactions | Yes (local) | No | On-device AI personalisation |
| App activity (word usage) | Yes (local) | No | Improve word predictions |
| Crash logs | No | No | — |
| Device identifiers | No | No | — |
| Location | No | No | — |
| Financial info | No | No | — |
| Photos/Videos | Processed locally | No | Camera-based object recognition |

## Detailed Responses

### Is any data collected or shared?
Yes — the app collects data to provide its core functionality.

### Data collected

**1. Personal info — Email address**
- Collected: Optional (only if user creates an account)
- Purpose: App functionality (authentication)
- Encrypted in transit: Yes (Firebase Auth uses HTTPS)
- User can request deletion: Yes (via Firebase Auth account deletion)

**2. Personal info — Name**
- Collected: Optional (during signup)
- Purpose: App functionality (profile display)
- Encrypted in transit: Yes
- User can request deletion: Yes

**3. App activity — In-app interactions**
- Collected: Yes
- Purpose: App functionality and personalisation
- Storage: On-device only (AsyncStorage)
- This data is NOT transmitted to any server by default
- User can delete this data: Yes (Settings → Reset AI Data)

### Data NOT collected
- Precise or approximate location
- Financial or payment information
- Health or fitness data
- Messages or communication content (to servers)
- Photos or videos (processed on-device only, not uploaded)
- Audio recordings
- Files and documents
- Calendar events
- Contacts
- Device identifiers (AAID, IMEI)
- Browsing or search history

### Data shared with third parties
No data is shared with third parties.

### Data handling
- All communication data (words tapped, sentences spoken) is stored locally on-device
- Cloud sync is opt-in (requires authentication) and only syncs settings, not communication content
- The `getPrivacySafeSummary()` function returns only aggregate statistics, never raw communication data
- Users can disable AI personalisation entirely in Settings
- Users can reset all learned data in Settings
- Firebase Authentication data is handled by Google Firebase (see Firebase privacy policy)
- Firebase Realtime Database stores only settings and optional feedback

### Security
- Data encrypted in transit (HTTPS/TLS)
- Local data stored via AsyncStorage (device-encrypted storage on Android)
- No sensitive data in application logs
- Firebase credentials use standard security rules

### Data deletion
- Users can reset AI personalisation data from Settings
- Users can delete their account (removes all cloud-synced data)
- Uninstalling the app removes all local data
