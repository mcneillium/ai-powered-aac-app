// Expo's generated local release build otherwise uses the public debug key.
// EAS may inject its managed release signing config after prebuild; inspect
// the actual task graph/config at execution time, rather than blocking EAS.
const { withAppBuildGradle } = require('expo/config-plugins');
const MARKER = '// Voice release signing guard';
const GUARD = `
${MARKER}
gradle.taskGraph.whenReady { graph ->
    def releaseTasks = graph.allTasks.findAll { it.project.path == ':app' && it.name in ['assembleRelease', 'bundleRelease', 'packageRelease'] }
    if (!releaseTasks.isEmpty()) {
        def signing = android.buildTypes.release.signingConfig
        def debugKey = signing == null || signing.name == 'debug'
        def isBundle = releaseTasks.any { it.name == 'bundleRelease' }
        def allowTestApk = project.findProperty('ALLOW_DEBUG_SIGNING') == 'true'
        if (debugKey && (isBundle || !allowTestApk)) {
            throw new GradleException('Voice release signing is not configured. Use managed production credentials, or ALLOW_DEBUG_SIGNING=true for a test APK only. Debug-signed release bundles are refused.')
        }
    }
}
`;
module.exports = function withReleaseSigningGuard(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Voice signing guard requires the Expo Groovy Android template.');
    if (!mod.modResults.contents.includes(MARKER)) mod.modResults.contents += GUARD;
    return mod;
  });
};
