// metro.config.js
// Extends @react-native/metro-config (required by RN CLI / Gradle bundling)
// then layers Expo defaults on top.
const { getDefaultConfig: getExpoDefault } = require('@expo/metro-config');
const { mergeConfig, getDefaultConfig: getRNDefault } = require('@react-native/metro-config');

// Start from the RN base (satisfies the RN CLI check)
const rnDefault = getRNDefault(__dirname);

// Layer Expo defaults on top
const expoDefault = getExpoDefault(__dirname);

const config = mergeConfig(rnDefault, expoDefault);

// Disable the new package-exports resolution
config.resolver.unstable_enablePackageExports = false;

// Ensure all needed source extensions are present
const extraSourceExts = ['mjs', 'jsx', 'js', 'ts', 'tsx', 'json'];
const currentSourceExts = config.resolver.sourceExts || [];
for (const ext of extraSourceExts) {
  if (!currentSourceExts.includes(ext)) {
    currentSourceExts.push(ext);
  }
}
config.resolver.sourceExts = currentSourceExts;

// Add .bin to asset extensions
if (!config.resolver.assetExts.includes('bin')) {
  config.resolver.assetExts.push('bin');
}

// Map problematic modules to an empty module
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  idb: require.resolve('./empty-module.js'),
  './postinstall.mjs': require.resolve('./empty-module.js'),
  'react-native-fs': require.resolve('./empty-module.js'),
};

module.exports = config;
