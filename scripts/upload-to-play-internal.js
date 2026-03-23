#!/usr/bin/env node
/**
 * Upload Voice AAB to Google Play Internal Testing track.
 *
 * Usage:
 *   node scripts/upload-to-play-internal.js \
 *     --key  <path-to-service-account.json> \
 *     --aab  <path-to-Voice.aab>
 *
 * Example (Windows):
 *   node scripts/upload-to-play-internal.js ^
 *     --key  "C:\Users\McNei\Secrets\play-service-account.json" ^
 *     --aab  "C:\Users\McNei\Downloads\Voice.aab"
 *
 * Requirements:
 *   npm install  (googleapis must be in devDependencies)
 *
 * This script:
 *   1. Authenticates via Google service account
 *   2. Creates a new edit
 *   3. Uploads the AAB
 *   4. Assigns it to the "internal" track
 *   5. Commits the edit
 *   6. Reports version code and status
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ── Config ──────────────────────────────────────────────────
const PACKAGE_NAME = 'com.elpabloawakens.aipoweredaacapp';
const TRACK = 'internal';

// ── Parse args ──────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    opts[key] = args[i + 1];
  }
  if (!opts.key || !opts.aab) {
    console.error('Usage: node scripts/upload-to-play-internal.js --key <service-account.json> --aab <Voice.aab>');
    process.exit(1);
  }
  return opts;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  // Validate files exist
  if (!fs.existsSync(opts.key)) {
    console.error(`Service account JSON not found: ${opts.key}`);
    process.exit(1);
  }
  if (!fs.existsSync(opts.aab)) {
    console.error(`AAB file not found: ${opts.aab}`);
    process.exit(1);
  }

  const aabSize = (fs.statSync(opts.aab).size / 1024 / 1024).toFixed(1);
  console.log(`Package:  ${PACKAGE_NAME}`);
  console.log(`Track:    ${TRACK}`);
  console.log(`AAB:      ${opts.aab} (${aabSize} MB)`);
  console.log('');

  // 1. Authenticate
  console.log('Authenticating with service account...');
  const auth = new google.auth.GoogleAuth({
    keyFile: opts.key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const authClient = await auth.getClient();
  const play = google.androidpublisher({ version: 'v3', auth: authClient });

  // 2. Create edit
  console.log('Creating new edit...');
  const editRes = await play.edits.insert({
    packageName: PACKAGE_NAME,
    requestBody: {},
  });
  const editId = editRes.data.id;
  console.log(`Edit ID:  ${editId}`);

  // 3. Upload AAB
  console.log('Uploading AAB (this may take a moment)...');
  const uploadRes = await play.edits.bundles.upload({
    packageName: PACKAGE_NAME,
    editId,
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(opts.aab),
    },
  });
  const versionCode = uploadRes.data.versionCode;
  console.log(`Uploaded: versionCode ${versionCode}`);

  // 4. Assign to internal track
  console.log(`Assigning to "${TRACK}" track...`);
  await play.edits.tracks.update({
    packageName: PACKAGE_NAME,
    editId,
    track: TRACK,
    requestBody: {
      track: TRACK,
      releases: [
        {
          versionCodes: [String(versionCode)],
          status: 'completed',
          releaseNotes: [
            {
              language: 'en-GB',
              text: [
                'Smart word suggestions on the main communication board',
                'New guided onboarding experience',
                'Sentence history — tap to repeat recent messages',
                'Offline indicator when disconnected',
                'Improved screen reader labels and accessibility',
                'AI personalisation controls in Settings',
                'Performance improvements and bug fixes',
              ].join('\n'),
            },
          ],
        },
      ],
    },
  });
  console.log(`Track "${TRACK}" updated.`);

  // 5. Commit
  console.log('Committing edit...');
  await play.edits.commit({
    packageName: PACKAGE_NAME,
    editId,
  });

  // 6. Done
  console.log('');
  console.log('────────────────────────────────────────');
  console.log('Upload successful.');
  console.log(`  Package:      ${PACKAGE_NAME}`);
  console.log(`  Version code: ${versionCode}`);
  console.log(`  Track:        ${TRACK}`);
  console.log(`  Status:       completed`);
  console.log('────────────────────────────────────────');
  console.log('');
  console.log('Next: Open Play Console → Internal testing to verify and manage testers.');
}

main().catch((err) => {
  console.error('');
  console.error('Upload failed.');
  console.error('');

  if (err.code === 401 || err.code === 403) {
    console.error('PERMISSION ERROR:');
    console.error('The service account does not have permission to upload to this app.');
    console.error('');
    console.error('Fix: In Google Play Console → Settings → API access:');
    console.error(`  1. Ensure the service account has "Release manager" or "Admin" role`);
    console.error(`  2. Ensure it has access to app: ${PACKAGE_NAME}`);
    console.error('  3. Changes take up to 24h to propagate (usually minutes)');
  } else if (err.code === 404) {
    console.error('APP NOT FOUND:');
    console.error(`Package "${PACKAGE_NAME}" was not found in your Play Console.`);
    console.error('');
    console.error('Fix: Ensure you have created the app listing in Play Console first.');
    console.error('The app entry must exist before you can upload an AAB via API.');
  } else if (err.message && err.message.includes('versionCode')) {
    console.error('VERSION CODE CONFLICT:');
    console.error('A bundle with this versionCode may already exist.');
    console.error('');
    console.error('Fix: Increment versionCode in app.json and rebuild the AAB.');
  } else {
    console.error('Error details:');
    console.error(err.message || err);
    if (err.errors) {
      err.errors.forEach((e) => console.error(`  - ${e.message}`));
    }
  }

  process.exit(1);
});
