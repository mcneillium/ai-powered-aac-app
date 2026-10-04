/* eslint-env node */
// Live system font size change vs a fresh start at the same scale (layout bounds and sentence).
// Usage: SERIAL=... RUN=name node fontscale-compare.js 1.3,2.0,1.0
// Compare layout after a live font change with a fresh start at the same scale.
const d = require('./drv');
const KEYS = [/^Communicate$/, /^(Sentence|Message): /, /^Speak (sentence|message):/, /^Delete last word$/, /^Suggestion: /, /^Say I want\./, /^Say like\./, /^Go to home page$/, /^Find a word/];
const snap = (nodes) => Object.fromEntries(KEYS.map((k) => {
  const n = nodes.find((x) => k.test(x.label)); return [k.source, n ? n.bounds : null];
}));
async function build() {
  const s = await d.find('Skip onboarding', { timeout: 800 }); if (s) await d.tap(s, { wait: 1500 });
  const c = await d.find('Clear', { timeout: 1500 }); if (c && c.enabled === 'true') await d.tap(c);
  await d.tap(/^Say I want\./); await d.tap(/^Say I need\./);
}
(async () => {
  const scales = (process.argv[2] || '1.3,2.0,1.0').split(',');
  d.sh('settings put system font_scale 1.0');
  d.forceStop(); d.adb(['logcat', '-c']); d.launch(); await d.sleep(6500);
  await build();
  for (const s of scales) {
    d.sh(`settings put system font_scale ${s}`); await d.sleep(4500);
    const live = await d.dump(`live-${s}`); d.screenshot(`live-${s}`);
    const sent = live.find((x) => /^(Sentence|Message)/.test(x.label));
    d.check(`L1 sentence kept on live change to ${s}`, sent && /^(Sentence|Message): I want I need$/.test(sent.label), sent ? sent.label : 'none');
    const liveSnap = snap(live);
    // fresh start at the same scale, same sentence
    d.forceStop(); d.launch(); await d.sleep(6500); await build();
    const fresh = await d.dump(`fresh-${s}`); d.screenshot(`fresh-${s}`);
    const freshSnap = snap(fresh);
    const diffs = Object.keys(liveSnap).filter((k) => liveSnap[k] !== freshSnap[k]).map((k) => `${k}: live ${liveSnap[k]} vs fresh ${freshSnap[k]}`);
    d.check(`L2 layout after live change to ${s} matches a fresh start at ${s}`, diffs.length === 0, diffs.join(' | ') || 'all key bounds identical');
    // keep going from this running app for the next live change (sentence rebuilt by build())
  }
  const crash = d.adb(['logcat', '-d', '-b', 'crash']);
  d.check('L3 no crash', !/prtest/.test(crash), crash.trim().slice(0, 200) || 'crash buffer empty');
  const relaunch = (d.adb(['logcat', '-d']).match(/Running "main"/g) || []).length;
  note2(`"Running main" count in log: ${relaunch} (1 per fresh start expected: ${scales.length + 1})`);
  d.sh('settings put system font_scale 1.0');
  d.saveResults();
  function note2(m) { d.note(m); }
})().catch((e) => { d.note('ABORT ' + e.stack); d.saveResults(); });
