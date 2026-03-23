// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Disable the new package-exports resolution
defaultConfig.resolver.unstable_enablePackageExports = false;

// Add "mjs" (and your other custom) extensions
defaultConfig.resolver.sourceExts = [
  ...defaultConfig.resolver.sourceExts,
  'mjs',
  'jsx',
  'js',
  'ts',
  'tsx',
  'json',
];

// Keep your existing asset extensions
defaultConfig.resolver.assetExts.push('bin');

// Map problematic modules to an empty module if needed
defaultConfig.resolver.extraNodeModules = {
  ...defaultConfig.resolver.extraNodeModules,
  idb: require.resolve('./src/mocks/idb-mock.js'),
  './postinstall.mjs': require.resolve('./empty-module.js'),
  'react-native-fs': require.resolve('./empty-module.js'),
};

module.exports = defaultConfig;
