/* eslint-env node */
// Turns a freshly prebuilt android/ into the separate "Voice PR7 Test" app.
// Run from the app root after `expo prebuild --clean`. Never touches the repo.
const fs = require('fs');
const path = require('path');

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
  "applicationId 'com.elpabloawakens.aipoweredaacapp.prtest'"
);
g = g.replace(
  /signingConfigs \{\n\s+debug \{/,
  `signingConfigs {\n        prtest {\n            storeFile file('${ksPath}')\n            storePassword '${props.storePassword}'\n            keyAlias '${props.keyAlias}'\n            keyPassword '${props.keyPassword}'\n        }\n        debug {`
);
g = g.replace(
  /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
  '$1signingConfig signingConfigs.prtest'
);
if (!g.includes(".prtest'") || !g.includes('signingConfigs.prtest')) {
  throw new Error('build.gradle patch did not apply');
}
fs.writeFileSync(gradle, g);

const strings = 'android/app/src/main/res/values/strings.xml';
fs.writeFileSync(
  strings,
  fs.readFileSync(strings, 'utf8').replace(
    '<string name="app_name">Voice</string>',
    '<string name="app_name">Voice PR7 Test</string>'
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
console.log('test identity applied');
