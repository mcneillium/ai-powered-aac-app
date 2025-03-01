const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Add "mjs" to the list of source file extensions
defaultConfig.resolver.sourceExts = [
  ...defaultConfig.resolver.sourceExts,
  'mjs',
  'jsx',
  'js',
  'ts',
  'tsx',
  'json'
];

// Keep your existing asset extensions
defaultConfig.resolver.assetExts.push('bin');

// Map problematic modules to an empty module if needed
defaultConfig.resolver.extraNodeModules = {
  ...defaultConfig.resolver.extraNodeModules,
  'idb': require.resolve('./empty-module.js'),
  './postinstall.mjs': require.resolve('./empty-module.js'),
};

module.exports = defaultConfig;
