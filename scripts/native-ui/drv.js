/* eslint-env node */
// Minimal adb + UiAutomator driver for native UI tests of the separate
// "Voice PR7 Test" app. Evidence (screenshots, UI dumps, logs, results.json)
// goes to $EVIDENCE_DIR/<RUN>/ (default ./native-ui-evidence/<RUN>/).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SDK = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = process.env.ADB || path.join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
// Only ever the test package: the suite force-stops it, revokes its camera
// permission and (with ALLOW_TTS_DISABLE=1, emulator only) disables TTS.
const PKG = process.env.PKG || 'com.elpabloawakens.aipoweredaacapp.prtest';
const SERIAL = process.env.SERIAL || '';
const RUN = process.env.RUN || 'run';
const OUT = path.join(process.env.EVIDENCE_DIR || path.join(process.cwd(), 'native-ui-evidence'), RUN);
if (!/^com\.elpabloawakens\.aipoweredaacapp\.prtest[0-9a-z]*(\.debug)?$/.test(PKG)) throw new Error(`refusing to drive ${PKG}: only .prtest test apps`);
fs.mkdirSync(OUT, { recursive: true });

const log = [];
function note(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  log.push(line);
  fs.appendFileSync(path.join(OUT, 'steps.log'), line + '\n');
}

function adb(args, opts = {}) {
  const full = SERIAL ? ['-s', SERIAL, ...args] : args;
  return execFileSync(ADB, full, { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 64 << 20, timeout: opts.timeout || 60000 });
}
const sh = (cmd, opts) => adb(['shell', cmd], opts);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseNodes(xml) {
  const nodes = [];
  const re = /<node ([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const a = {};
    m[1].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => {
      a[k] = v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, '\n');
    });
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(a.bounds || '');
    if (b) {
      a.x1 = +b[1]; a.y1 = +b[2]; a.x2 = +b[3]; a.y2 = +b[4];
      a.cx = (a.x1 + a.x2) >> 1; a.cy = (a.y1 + a.y2) >> 1;
    }
    a.label = a['content-desc'] || a.text || '';
    nodes.push(a);
  }
  return nodes;
}

async function dump(name) {
  for (let i = 0; i < 4; i++) {
    try {
      sh('uiautomator dump /sdcard/voice_ui.xml', { timeout: 30000 });
      const xml = sh('cat /sdcard/voice_ui.xml');
      if (name) fs.writeFileSync(path.join(OUT, `${name}.xml`), xml);
      return parseNodes(xml);
    } catch (e) {
      await sleep(700);
    }
  }
  throw new Error('uiautomator dump failed');
}

function match(n, q) {
  return q instanceof RegExp ? q.test(n.label) : n.label === q;
}

async function find(q, { timeout = 8000, all = false } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const nodes = await dump();
    const hits = nodes.filter((n) => match(n, q) && n.x2 > n.x1);
    if (hits.length) return all ? hits : hits[0];
    if (Date.now() > end) return all ? [] : null;
    await sleep(400);
  }
}

async function tap(q, opts = {}) {
  const n = typeof q === 'object' && q && 'cx' in q ? q : await find(q, opts);
  if (!n) throw new Error(`not found: ${q}`);
  sh(`input tap ${n.cx} ${n.cy}`);
  await sleep(opts.wait ?? 450);
  return n;
}

function screenshot(name) {
  const png = adb(['exec-out', 'screencap', '-p'], { binary: true });
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  note(`screenshot ${name}.png`);
}

function logcatClear() { try { adb(['logcat', '-c']); } catch (_) { /* ignore */ } }
function logcatSave(name, filter = '') {
  const txt = adb(['logcat', '-d', '-v', 'time', ...(filter ? filter.split(' ') : [])]);
  fs.writeFileSync(path.join(OUT, `${name}.log`), txt);
  return txt;
}

function launch() {
  sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
}
function forceStop() { sh(`am force-stop ${PKG}`); }

// Snapshot of audio players: shows whether any process is actually playing
// audio (state:started), which is stronger than "speech API was called" but
// still not proof that a person heard it.
function audioPlayers() {
  const out = sh('dumpsys audio');
  const start = out.indexOf('playback activity');
  return start >= 0 ? out.slice(start, start + 6000) : out.slice(0, 3000);
}

let failures = 0;
const results = [];
function check(id, ok, detail) {
  results.push({ id, ok, detail });
  if (!ok) failures++;
  note(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}
function saveResults() {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  return failures;
}

module.exports = {
  adb, sh, sleep, dump, find, tap, screenshot, logcatClear, logcatSave,
  launch, forceStop, audioPlayers, note, check, saveResults, results, PKG, OUT,
};
