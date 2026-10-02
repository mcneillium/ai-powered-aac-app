// Global Jest setup: in-memory AsyncStorage so modules that persist user data
// can be imported in tests. Individual tests may still jest.mock() it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
