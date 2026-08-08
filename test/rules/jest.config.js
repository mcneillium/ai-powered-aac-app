/**
 * Rules tests run against the Firebase emulator, not against a React Native
 * runtime, so they deliberately do NOT use the jest-expo preset the app tests
 * use. They also need real timers and a long timeout — the emulator takes a few
 * seconds to accept its first connection.
 *
 * Run: npm run test:rules   (starts the emulator, runs this config, tears down)
 */
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/**/*.test.js'],
  testTimeout: 30_000,
  // The emulator is a shared, stateful resource. Parallel suites would race on
  // the same database, so they run one at a time.
  maxWorkers: 1,
};
