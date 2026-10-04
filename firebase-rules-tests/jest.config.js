/* eslint-env node */
// Jest config for the Firebase rules tests only. Kept apart from the app's
// Jest setup (jest-expo) because these run in Node against local emulators
// and are started by `npm run test:rules`, never by the normal `npm test`.
module.exports = {
  rootDir: __dirname,
  testMatch: ['<rootDir>/**/*.emulator.js'],
  testEnvironment: 'node',
  transform: {},
  testTimeout: 30000,
};
