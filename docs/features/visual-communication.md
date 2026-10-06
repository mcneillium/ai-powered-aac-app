# Visual communication expansion

This change builds on PR #11 (`ae665d6`) without replacing either board. It is development code, not a released or device-verified APK. The new Expo sharing, document-picker and printing modules require a native rebuild.

## Available features

| Feature | Where | Behaviour |
|---|---|---|
| Pictures with messages | Studio Talk, suggestions, Phrases, Saved, repair choices | Prefer current local personal photos/downloaded symbols; otherwise known emoji. Original words remain. Picture support can be switched off in either mode. |
| Related-word finder | Talk → Find | Direct matches first; curated related choices such as thirsty → drink/water/juice. Results identify the existing page. No inferred intent, remote search or tile rearrangement. |
| Inspectable learning | Personalise/Me/Settings → How suggestions learn | Actual model/status statistics, optional real local prediction probe, isolated synthetic adaptation/reset demonstration. |
| Photo scenes | More/Me/Settings → My scenes and communication tools | Three personal photos, up to twelve named phrase points per scene; accessible list alternatives. Select a point, then explicitly Speak. |
| Communication repair | Communication tools → Explain | Original and alternative messages kept separately, repair phrases, a user-defined intensity scale, temporary drawing. No automatic rewrite or speaking. |
| Conversation workspace | More → Save a thought / my messages; Me/Settings → My messages | Park up to ten drafts, keep one thought while preparing another, resume with current draft preserved, explicit board handoff with board Undo, optional English forms for supported last words. |
| Portable vocabulary | Personalise/Me/Settings → Export or print my board | Voice-specific JSON and printable PDF; optional embedded personal photos; additive import with preview. Existing labels and positions remain. |
| Portable scenes | Communication tools → Backup | Scene JSON export/import and PDF with the photo, numbered points and phrase legend. Import replaces scenes only after confirmation. |

## Meaning, learning and data

- Pictures supplement text. Unknown and abstract words retain text; emoji are not guaranteed to be universally understood. Existing string-only sentences/history do not retain historical symbol IDs: pictures resolve against current vocabulary. Ambiguous personal labels do not choose an arbitrary photo.
- Core tile locations are unchanged. Paper layout is explicitly a separate layout; it can span pages and must be checked before relying on it.
- The shipped predictor is an n-gram model plus a linear reranker. The two held-out synthetic examples demonstrate adaptation, pause and reset; they are not an accuracy benchmark or evidence of clinical benefit or superiority.
- Learning remains opt-in. Diagnostics/draft saving/scene editing do not train a personal model. The existing board speech path remains responsible for consent-controlled learning.
- Scene storage is `@voice_communication_scenes_v1`, limited to about 1.9 million characters, with compressed pictures around 450 KB each. Draft storage is `@voice_conversation_drafts_v1`, ten messages of up to 4,000 characters. Both stay local apart from operating-system backup.
- Vocabulary imports use the existing custom-word store. Signed-in users must explicitly allow its existing label/category account sync. Photos remain local. Import is additive and may partially succeed if storage fails; the result reports this rather than claiming rollback.
- Export files can contain personal pictures and words. The native chooser is opened only after an explicit action. Receiver apps may read after the chooser closes, so private export cache files are retained and cleaned after 24 hours on the next app launch/export, or when personal data is deleted. Copies saved/shared outside Voice are not deleted by Voice.
- Imports validate format/version, sizes and image encodings. Imported image paths and remote URLs are refused. Printed text is HTML-escaped. No model, photo recognition endpoint or new cloud service is enabled.
- Delete my words and messages/account deletion cancel and drain active vocabulary import, clear new scenes/drafts and private export copies, and invalidate pending writes. Tests cover delayed-write races. Existing signed-in vocabulary resync behaviour remains disclosed by the app.
- Edit lock blocks scene editing/import and vocabulary import; communication remains available. In-app scanning covers scene buttons and workspace controls. System keyboard, photo/file pickers and native alerts require OS access support. Drawing remains touch-based.

## Scope and verification limits

The vocabulary format is not Open Board Format, a complete account backup, or a cross-vendor compatibility claim. It excludes history, favourites, learning, settings and scenes; scenes have their own format. Downloaded ARASAAC artwork is not included in portable board exports. Existing symbol licence restrictions still apply; new native module notices are generated into the app's licences screen.

No general multilingual vocabulary/prediction model, eye-gaze implementation, voice cloning, automatic photo recognition, clinical assessment or autonomous speech was added. Available system voice choices and the existing modelling/access controls remain as before.

Automated service/component tests and Android export are useful but cannot establish Samsung rendering, photo picker behaviour, receiver-file lifetime, native PDF layout, TalkBack, physical switches or listener understanding. Run section I of the device checklist before release. Evaluate usefulness with AAC users and communication partners using task completion, taps/time to intended message, correction burden, picture comprehension and user preference; do not substitute synthetic prediction scores.

## Test APK handling

A newly signed native build is required. Preserve the established test key to update the same test identity, or choose a separate test package; never uninstall to resolve a signing conflict. Store the extracted APK and matching checksums/build notes under `C:\Users\McNei\OneDrive\AAC\Builds\YYYY-MM-DD_<commit>\`. Update `Latest\` only after verification. This cloud checkout cannot verify a copy into that Windows folder or OneDrive sync.
