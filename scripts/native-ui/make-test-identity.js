/* eslint-env node */
// Turns a freshly prebuilt android/ into a separate test app that can never
// replace the real Voice app. Run from the app root after
// `expo prebuild --clean`. Changes only the generated android/ folder.
//
//   node make-test-identity.js [abis] (defaults: arm64-v8a,x86_64)
//   PRTEST_ID=prtest2 PRTEST_NAME="Voice PR7 Test 2" node make-test-identity.js
//
// PRTEST_ID / PRTEST_NAME give a different package for a phone whose existing
// test app was signed with another key (it then installs alongside instead of
// needing an uninstall). Defaults: prtest / "Voice PR7 Test".
const fs = require('fs');
const path = require('path');

const ID = process.env.PRTEST_ID || 'prtest';
const NAME = process.env.PRTEST_NAME || 'Voice PR7 Test';
if (!/^prtest[0-9a-z]*$/.test(ID)) throw new Error(`PRTEST_ID must start with "prtest": ${ID}`);
const ks = path.join(process.env.LOCALAPPDATA, 'VoiceTest');
const props = Object.fromEntries(
  fs.readFileSync(path.join(ks, 'prtest.properties'), 'utf8')
    .split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))
);
const ksPath = path.join(ks, 'prtest.keystore').replace(/\\/g, '/');

const gradle = 'android/app/build.gradle';
let g = fs.readFileSync(gradle, 'utf8');
g = g.replace(
  "applicationId 'com.elpabloawakens.aipoweredaacapp'",
  `applicationId 'com.elpabloawakens.aipoweredaacapp.${ID}'`
);
g = g.replace(
  /signingConfigs \{\n\s+debug \{/,
  `signingConfigs {\n        prtest {\n            storeFile file('${ksPath}')\n            storePassword '${props.storePassword}'\n            keyAlias '${props.keyAlias}'\n            keyPassword '${props.keyPassword}'\n        }\n        debug {`
);
g = g.replace(
  /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
  '$1signingConfig signingConfigs.prtest'
);
if (!g.includes(`.${ID}'`) || !g.includes('signingConfigs.prtest')) {
  throw new Error('build.gradle patch did not apply');
}
fs.writeFileSync(gradle, g);

const strings = 'android/app/src/main/res/values/strings.xml';
fs.writeFileSync(
  strings,
  fs.readFileSync(strings, 'utf8').replace(
    '<string name="app_name">Voice</string>',
    `<string name="app_name">${NAME.replace(/[<&>]/g, '')}</string>`
  )
);

const gp = 'android/gradle.properties';
fs.writeFileSync(
  gp,
  fs.readFileSync(gp, 'utf8').replace(
    /^reactNativeArchitectures=.*$/m,
    `reactNativeArchitectures=${process.argv[2] || 'arm64-v8a,x86_64'}`
  )
);
console.log(`test identity applied: com.elpabloawakens.aipoweredaacapp.${ID} "${NAME}"`);
