/* eslint-env jest, node */
// The config plugin that keeps Voice usable when the system font size changes
// while the app is open (Android). Verified natively on Android 15 and 11
// emulators; these tests guard the generated native code.
const plugin = require('../../plugins/withFontScaleConfigChange');
const appJson = require('../../app.json');

const TEMPLATE_ACTIVITY = `package com.example

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

function manifestWith(configChanges) {
  return {
    manifest: {
      application: [{
        $: { 'android:name': '.MainApplication' },
        activity: [{
          $: { 'android:name': '.MainActivity', 'android:configChanges': configChanges },
          'intent-filter': [{
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          }],
        }],
      }],
    },
  };
}
const mainActivity = (m) => m.manifest.application[0].activity[0].$['android:configChanges'];

test('app.json applies the plugin', () => {
  expect(appJson.expo.plugins).toContain('./plugins/withFontScaleConfigChange');
});

test('adds fontScale to the main activity configChanges, keeping the rest', () => {
  const m = plugin.addConfigChanges(manifestWith('keyboard|orientation|uiMode'));
  expect(mainActivity(m)).toBe('keyboard|orientation|uiMode|fontScale');
  expect(mainActivity(plugin.addConfigChanges(m))).toBe('keyboard|orientation|uiMode|fontScale');
});

test('MainActivity reloads only when the font scale really changes', () => {
  const out = plugin.addActivityRelayout(TEMPLATE_ACTIVITY);
  expect(out).toContain(plugin.ACTIVITY_MARKER);
  expect(out).toContain('if (newConfig.fontScale == voiceFontScale) return');
  expect(out).toContain('DisplayMetricsHolder.initDisplayMetrics(this)');
  expect(out).toContain('reactHost?.reload(');
  expect(out).toContain('voiceFontScale = resources.configuration.fontScale');
  expect(out.trim().endsWith('}')).toBe(true);
  // the original class body is kept
  expect(out).toContain('override fun getMainComponentName(): String = "main"');
});

test('is idempotent and refuses to clobber an existing override', () => {
  const once = plugin.addActivityRelayout(TEMPLATE_ACTIVITY);
  expect(plugin.addActivityRelayout(once)).toBe(once);
  const custom = TEMPLATE_ACTIVITY.replace(
    '}\n',
    '  override fun onConfigurationChanged(c: android.content.res.Configuration) { super.onConfigurationChanged(c) }\n}\n'
  );
  expect(() => plugin.addActivityRelayout(custom)).toThrow(/already overrides/);
});

test('does not use React Native feature-flag overrides', () => {
  const out = plugin.addActivityRelayout(TEMPLATE_ACTIVITY);
  expect(out).not.toMatch(/FeatureFlags|dangerously/);
});
