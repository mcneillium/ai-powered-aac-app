// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ---------- TFJS: treat model.json + .bin as static assets ----------
const assetExts = new Set(config.resolver.assetExts);
assetExts.add('bin');   // TFJS weight shards
assetExts.add('json');  // TFJS model.json must be served raw
config.resolver.assetExts = Array.from(assetExts);

// ---------- Don’t parse .json as JS modules ----------
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'json');

// ---------- Keep .mjs (some deps ship ESM-only files) ----------
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// ---------- Optional shims for noisy deps (safe to keep) ----------
config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  idb: path.resolve(__dirname, './empty-module.js'),
  './postinstall.mjs': path.resolve(__dirname, './empty-module.js'),
};

module.exports = config;
