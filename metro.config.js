// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add .bin to asset extensions for TensorFlow model weights
defaultConfig.resolver.assetExts.push('bin');

// Shim modules that don't work in React Native
defaultConfig.resolver.extraNodeModules = {
  ...defaultConfig.resolver.extraNodeModules,
  idb: require.resolve('./src/mocks/idb-mock.js'),
  'react-native-fs': require.resolve('./empty-module.js'),
};

module.exports = defaultConfig;
