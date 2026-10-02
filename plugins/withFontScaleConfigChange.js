// Expo config plugin: keep Voice usable when the system font size changes
// while the app is open.
//
// Measured on the Android 15 emulator before this plugin (font 1.0 -> 1.3 and
// 2.0 -> 1.0 while open): Android relaunched the activity and React Native
// re-ran the app on the same React instance. The sentence being built was
// erased, and text was laid out with the old font metrics but drawn at the new
// size, so labels were cut off until the app was restarted.
//
// What this plugin does:
// 1. Adds "fontScale" to the main activity's android:configChanges, so Android
//    no longer relaunches the activity.
// 2. MainActivity, when the font scale really changes, refreshes React
//    Native's display metrics and reloads the React instance in place
//    (ReactHost.reload). The reloaded UI is laid out at the new size, the same
//    as a fresh start (measured: identical bounds). The board restores the
//    sentence and page afterwards (src/services/sentenceDraft.js).
//
// Tried and rejected (measured): only configChanges (state kept, layout still
// stale); React Native's experimental enableFontScaleChangesUpdatingLayout
// flag (text still laid out at the old size, and the flag can only be set
// through dangerouslyForceOverride).
const { withAndroidManifest, withMainActivity, AndroidConfig } = require('expo/config-plugins');

const HANDLED = ['fontScale'];
const ACTIVITY_MARKER = 'Voice: relayout on system font size change';
const ACTIVITY_CODE = `
  // ${ACTIVITY_MARKER} (plugins/withFontScaleConfigChange.js)
  private var voiceFontScale = 0f

  override fun onPostCreate(savedInstanceState: android.os.Bundle?) {
    super.onPostCreate(savedInstanceState)
    voiceFontScale = resources.configuration.fontScale
  }

  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    if (newConfig.fontScale == voiceFontScale) return
    voiceFontScale = newConfig.fontScale
    // React Native measures text with metrics read at start-up; refresh them
    // and reload so the UI is laid out at the new size.
    com.facebook.react.uimanager.DisplayMetricsHolder.initDisplayMetrics(this)
    (application as? com.facebook.react.ReactApplication)?.reactHost?.reload("system font size changed")
  }
`;

function addConfigChanges(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const current = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
  for (const change of HANDLED) {
    if (!current.includes(change)) current.push(change);
  }
  activity.$['android:configChanges'] = current.join('|');
  return manifest;
}

function addActivityRelayout(src) {
  if (src.includes(ACTIVITY_MARKER)) return src;
  if (/override fun (onConfigurationChanged|onPostCreate)\b/.test(src)) {
    throw new Error('withFontScaleConfigChange: MainActivity already overrides onConfigurationChanged/onPostCreate; merge by hand');
  }
  const end = src.lastIndexOf('}');
  if (end < 0) throw new Error('withFontScaleConfigChange: MainActivity class end not found');
  return `${src.slice(0, end).replace(/\s*$/, '\n')}${ACTIVITY_CODE}}\n`;
}

module.exports = function withFontScaleConfigChange(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addConfigChanges(cfg.modResults);
    return cfg;
  });
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withFontScaleConfigChange: expected a Kotlin MainActivity');
    }
    cfg.modResults.contents = addActivityRelayout(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.addConfigChanges = addConfigChanges;
module.exports.addActivityRelayout = addActivityRelayout;
module.exports.ACTIVITY_MARKER = ACTIVITY_MARKER;
