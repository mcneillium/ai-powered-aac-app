/* eslint-env node */
// Font size reload keeps sentence and page; dark mode does not reload; ordinary restart starts empty.
const d = require('./drv');
const mains = () => (d.adb(['logcat', '-d']).match(/Running "main"/g) || []).length;
(async () => {
  d.sh('settings put system font_scale 1.0');
  d.forceStop(); d.adb(['logcat', '-c']); d.launch(); await d.sleep(6500);
  const c = await d.find('Clear', { timeout: 1500 }); if (c && c.enabled === 'true') await d.tap(c);
  await d.tap(/^Say I want\./);
  // go to People page (scroll grid to reach it)
  let nav = null;
  for (let i = 0; i < 5; i++) {
    nav = await d.find(/^Go to People page/, { timeout: 500 });
    if (nav && nav.cy < 2100) break;
    d.sh('input swipe 540 2000 540 1500 400'); await d.sleep(700);
  }
  await d.tap(nav, { wait: 1500 });
  await d.tap(/^Say she\./, { wait: 800 });
  const before = (await d.find(/^Sentence/)).label;
  const m0 = mains();
  d.sh('settings put system font_scale 1.5'); await d.sleep(7000);
  const after = await d.find(/^Sentence/, { timeout: 3000 });
  const page = await d.find(/^Say she\./, { timeout: 2000 });
  d.screenshot('X1-people-after-font-1.5');
  d.check('X1 sentence restored after font change reload', after && after.label === before, `${before} -> ${after && after.label}`);
  d.check('X1 page restored (People)', !!page, page ? 'People page shown' : 'not on People');
  d.check('X1 exactly one reload for one font change', mains() - m0 === 1, `Running main +${mains() - m0}`);
  // dark mode switch: must not reload or lose the sentence
  const m1 = mains();
  d.sh('cmd uimode night yes'); await d.sleep(4000);
  const s2 = await d.find(/^Sentence/, { timeout: 3000 });
  d.check('X2 dark mode switch does not reload', mains() - m1 === 0, `Running main +${mains() - m1}`);
  d.check('X2 sentence kept through dark mode switch', s2 && s2.label === before, s2 && s2.label);
  d.sh('cmd uimode night no'); await d.sleep(3000);
  // ordinary restart, same font: starts empty as before
  d.forceStop(); d.launch(); await d.sleep(6500);
  const s3 = await d.find(/^Sentence/, { timeout: 3000 });
  d.check('X3 ordinary restart starts with an empty sentence (unchanged)', s3 && /bar is empty/.test(s3.label), s3 && s3.label);
  d.sh('settings put system font_scale 1.0'); await d.sleep(5000);
  d.saveResults();
})().catch((e) => { d.note('ABORT ' + e.stack); d.saveResults(); });
