const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = config.resolver;

config.resolver.assetExts = Array.from(new Set([...assetExts, 'bin']));
config.resolver.sourceExts = Array.from(new Set([...sourceExts, 'mjs']));
config.resolver.unstable_enablePackageExports = false;

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  idb: require.resolve('./empty-module.js'),
  './postinstall.mjs': require.resolve('./empty-module.js'),
};

module.exports = config;
