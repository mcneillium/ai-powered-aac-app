/* eslint-env node */
// Native UI suite for "Voice PR7 Test". Usage: SERIAL=... RUN=name node suite.js [sections]
// Sections: board, history, settings, compact, fonts, speech, longtext, ttserror, persist
const d = require('./drv');
const { sleep, note, check } = d;

const want = (process.argv[2] || 'board,history,settings,compact,fonts,speech,camera,longtext,ttserror,persist').split(',');
const TTS = 'com.google.android.tts';

const sentence = async () => {
  const n = await d.find(/^Sentence(:| bar is empty)/, { timeout: 3000 });
  return n ? n.label : null;
};
const gridTop = async (label = /^Say I want\./) => {
  const n = await d.find(label, { timeout: 3000 });
  return n ? n.y1 : null;
};
function keyboardShown() {
  return /mInputShown=true/.test(d.sh('dumpsys input_method | grep mInputShown'));
}
async function hideKeyboard() {
  if (keyboardShown()) { d.sh('input keyevent KEYCODE_BACK'); await sleep(600); }
}
// Clear a text field and type into it; text uses %s for spaces.
async function typeInto(label, text) {
  await hideKeyboard();
  const f = await scrollTo(label);
  if (!f) throw new Error(`field not found: ${label}`);
  await d.tap(f, { wait: 900 });
  d.sh('input keycombination 113 29'); // Ctrl+A
  d.sh('input keyevent KEYCODE_DEL');
  for (let i = 0; i < text.length; i += 400) d.sh(`input text "${text.slice(i, i + 400)}"`);
  await sleep(500);
  const after = await d.find(label);
  await hideKeyboard();
  return after ? after.text : null;
}
// A grid button counts as visible only if it sits fully above the tab bar.
async function visibleWord(q) {
  const tab = await d.find(/tab$/, { timeout: 800 });
  const limit = tab ? tab.y1 : 2400;
  const hits = await d.find(q, { all: true, timeout: 800 });
  return hits.find((n) => n.cy < limit - 20) || null;
}
async function tapW(re, opts = {}) {
  const n = await visibleWord(re);
  if (!n) throw new Error(`word not fully visible above the tab bar: ${re}`);
  return d.tap(n, opts);
}
async function toBoard() {
  for (let i = 0; i < 4; i++) {
    if (await d.find('Open settings', { timeout: 800 }) || await d.find(/^Go to home page/, { timeout: 300 })) return;
    d.sh('input keyevent KEYCODE_BACK');
    await sleep(800);
  }
}
async function goHome() {
  const h = await d.find('Go to home page', { timeout: 1000 });
  if (h && h.enabled === 'true') await d.tap(h, { wait: 700 });
}
async function clearIfAny() {
  const c = await d.find('Clear', { timeout: 1000 });
  if (c && c.enabled === 'true') await d.tap(c, { wait: 500 });
}
async function openSettings() {
  const s = await d.find('Open settings', { timeout: 1500 });
  if (s) return d.tap(s, { wait: 1400 });
  return d.tap('Settings', { wait: 1400 }); // compact page row
}
async function scrollTo(q, max = 10) {
  for (let i = 0; i < max; i++) {
    const n = await d.find(q, { timeout: 600 });
    if (n && n.y1 > 250 && n.y2 < 2250) return n;
    d.sh('input swipe 540 1700 540 1000 350');
    await sleep(500);
  }
  return d.find(q, { timeout: 600 });
}
async function scrollTop() {
  for (let i = 0; i < 6; i++) { d.sh('input swipe 540 700 540 2000 200'); await sleep(250); }
}
async function setSwitch(label, on) {
  const n = await scrollTo(label);
  if (!n) throw new Error(`switch not found: ${label}`);
  const cur = n.checked === 'true';
  if (cur !== on) {
    d.sh(`input tap ${n.x2 - 70} ${n.cy}`);
    await sleep(700);
  }
  const after = await d.find(label, { timeout: 1500 });
  return after && after.checked === 'true';
}

// ---- speech evidence helpers -------------------------------------------
function ttsLog() {
  const lc = d.adb(['logcat', '-d', '-v', 'time']);
  const lines = lc.split('\n');
  return {
    requests: lines.filter((l) => /Synthesis request/.test(l)),
    // Audio tracks stopped by the TTS engine process ("D/AudioTrack( 2084): ...").
    stops: lines.filter((l) => /AudioTrack.*stop\(\d+\): called with \d+ frames delivered/.test(l)
      && new RegExp(`\\(\\s*${ttsPid()}\\)`).test(l)),
    raw: lc,
  };
}
let _ttsPid = null;
function ttsPid() {
  if (_ttsPid) return _ttsPid;
  try { _ttsPid = d.sh(`pidof ${TTS}`).trim().split(/\s+/)[0]; } catch (_) { _ttsPid = '?'; }
  return _ttsPid;
}
const framesOf = (l) => +(/with (\d+) frames delivered/.exec(l) || [])[1] || 0;
// Count audio players in state:started that belong to the TTS engine (uid of the engine).
function startedTtsPlayers() {
  const out = d.sh('dumpsys audio');
  const pid = ttsPid();
  return out.split('\n').filter((l) => /AudioPlaybackConfiguration/.test(l) && /state:started/.test(l) && l.includes(`/${pid} `)).length;
}
async function samplePlayers(ms, every = 150) {
  const s = [];
  const end = Date.now() + ms;
  while (Date.now() < end) { s.push(startedTtsPlayers()); await sleep(every); }
  return s;
}

(async () => {
  d.note(`sections: ${want.join(',')}`);
  d.sh('input keyevent KEYCODE_WAKEUP');

  if (want.includes('board')) {
    note('== A/board: offline start, sentence building, Delete, Clear, Undo, grid stability');
    d.forceStop(); d.logcatClear(); d.launch(); await sleep(5000);
    const skip = await d.find('Skip onboarding', { timeout: 1500 });
    if (skip) await d.tap(skip, { wait: 1500 });
    const board = await d.find(/^Say I want\./, { timeout: 8000 });
    check('A1 offline start shows board', !!board, board ? `first word at y=${board.y1}` : 'board not found');
    d.screenshot('A1-board-offline');
    const sb = /type=(?:statusBars|ITYPE_STATUS_BAR) frame=\[0,0\]\[\d+,(\d+)\]/.exec(d.sh('dumpsys window'));
    const sbBottom = sb ? +sb[1] : 0;
    const banner = await d.find('Offline — communication still works', { timeout: 1500 });
    check('A1b offline banner text is below the status bar', banner && banner.y1 >= sbBottom,
      banner ? `banner text y=${banner.y1}..${banner.y2}, status bar 0..${sbBottom}` : 'banner not shown');
    const crash = d.adb(['logcat', '-d', '-b', 'crash']).trim();
    check('A1 no crash buffer entries', crash.length === 0 || !/prtest/.test(crash), crash.slice(0, 200) || 'empty');
    await goHome(); await clearIfAny();

    const y0 = await gridTop();
    await tapW(/^Say I want\./); await tapW(/^Say help\./);
    let s = await sentence();
    check('A2 build "I want help"', s === 'Sentence: I want help', s);
    const y1 = await gridTop();
    const speak = await d.find(/^Speak sentence:/, { timeout: 1500 });
    check('A2 Speak enabled with words', speak && speak.enabled === 'true', speak ? speak.label : 'no speak');

    await d.tap('Delete last word');
    s = await sentence();
    check('A3 Delete removes last word', s === 'Sentence: I want', s);
    await d.tap('Undo last change to the sentence');
    s = await sentence();
    check('A3 Undo after Delete restores', s === 'Sentence: I want help', s);

    // long sentence (wraps / scrolls)
    for (const w of ['I', 'want', 'go', 'like', 'need', 'help', 'you', 'stop', 'go', 'like', 'need', 'help']) {
      await tapW(new RegExp(`^Say ${w}\\.`), { wait: 250 });
    }
    s = await sentence();
    check('A4 long sentence built', /Sentence: I want help I want go like need help you stop go like need help$/.test(s || ''), s);
    const y2 = await gridTop();
    d.screenshot('A4-long-sentence');
    await d.tap('Clear');
    s = await sentence();
    check('A5 Clear empties', /bar is empty/.test(s || ''), s);
    const y3 = await gridTop();
    await d.tap('Undo last change to the sentence');
    s = await sentence();
    check('A5 Undo after Clear restores whole sentence', /I want help I want go like need help you stop go like need help$/.test(s || ''), s);
    await d.tap('Clear');
    // other page
    for (let i = 0; i < 4 && !(await visibleWord(/^Go to Food page/)); i++) {
      d.sh('input swipe 540 2000 540 1500 400'); await sleep(700);
    }
    await d.tap(await visibleWord(/^Go to Food page/), { wait: 900 });
    const yFood = (await d.find(/^Say .*\. /, { timeout: 2000 }))?.y1;
    await goHome();
    check('E3 grid top stable (empty/words/long/cleared/other page)', new Set([y0, y1, y2, y3, yFood]).size === 1,
      `y empty=${y0} words=${y1} long=${y2} cleared=${y3} food=${yFood}`);
  }

  if (want.includes('history')) {
    note('== F/history and favourites');
    await toBoard(); await goHome(); await clearIfAny();
    await tapW(/^Say I need\./); await tapW(/^Say help\./);
    await d.tap(/^Speak sentence:/, { wait: 1500 });
    // Already a favourite from an earlier run (data kept across installs)? Then leave it.
    const add = await d.find('Add to favourites', { timeout: 1500 });
    if (add) await d.tap(add, { wait: 800 }); else note('phrase was already a favourite (kept from an earlier run)');
    const remove = await d.find('Remove from favourites', { timeout: 1500 });
    check('F favourite toggle switches to Remove', !!remove, remove ? remove.label : 'missing');
    await d.tap('Clear');
    await d.tap('Show sentence history', { wait: 900 });
    const rep = await d.find(/^Repeat: I need help/, { timeout: 2000 });
    check('F history lists spoken sentence', !!rep, rep ? rep.label : 'not in history');
    d.screenshot('F-history-open');
    if (rep) {
      await d.tap(rep, { wait: 900 });
      const s = await sentence();
      check('F history item replaces sentence', s === 'Sentence: I need help', s);
    }
    await d.tap(/^Hide sentence history|^Show favourites/, { wait: 600 });
    const showFav = await d.find('Show favourites', { timeout: 1000 });
    if (showFav) await d.tap(showFav, { wait: 900 });
    const fav = await d.find(/^Speak favourite: I need help/, { timeout: 2000 });
    check('F favourites list shows saved phrase', !!fav, fav ? fav.label : 'missing');
    d.screenshot('F-favourites-open');
    const hide = await d.find('Hide favourites', { timeout: 800 });
    if (hide) await d.tap(hide);
    await clearIfAny();
  }

  if (want.includes('settings')) {
    note('== B/settings: speed 0.5x, pronunciation');
    await toBoard();
    await openSettings();
    await d.tap('Speech speed 0.5x', { wait: 700 });
    const sp = await d.find('Speech speed 0.5x');
    check('B1 speed 0.5x selected', sp && sp.selected === 'true', `selected=${sp && sp.selected}`);
    const t1 = await typeInto('Word as written', 'help');
    const t2 = await typeInto('How it should sound', 'help%sme%splease');
    note(`typed: "${t1}" / "${t2}"`);
    d.logcatClear();
    await d.tap(await scrollTo('Save pronunciation and hear it'), { wait: 2500 });
    const entry = await scrollTo(/^help, said as help me please/);
    check('B5 pronunciation saved in list', !!entry, entry ? entry.label : 'missing');
    d.screenshot('B5-pronunciation-saved');
    await scrollTop();
    d.sh('input keyevent KEYCODE_BACK'); await sleep(900);

    // speed effect and substitution, measured from the engine
    await goHome(); await clearIfAny();
    d.logcatClear();
    await tapW(/^Say help\./, { wait: 4000 });
    let t = ttsLog();
    const s = await sentence();
    check('B5 screen still shows "help"', s === 'Sentence: help', s);
    check('B5 engine received a synthesis request on tap', t.requests.length >= 1, `${t.requests.length} request(s)`);
    const frames05 = t.stops.map(framesOf).reduce((a, b) => a + b, 0);
    note(`frames delivered for "help"->"help me please" at 0.5x: ${frames05}`);
    await clearIfAny();
    // compare with 1.0x
    await openSettings(); await d.tap('Speech speed 1x', { wait: 700 });
    d.sh('input keyevent KEYCODE_BACK'); await sleep(900);
    d.logcatClear();
    await tapW(/^Say help\./, { wait: 3000 });
    t = ttsLog();
    const frames10 = t.stops.map(framesOf).reduce((a, b) => a + b, 0);
    check('B1 0.5x produces longer audio than 1x (engine frames)', frames05 > frames10 * 1.2,
      `0.5x=${frames05} frames, 1x=${frames10} frames, ratio=${(frames05 / Math.max(frames10, 1)).toFixed(2)}`);
    await clearIfAny();
    await openSettings(); await d.tap('Speech speed 0.5x', { wait: 700 });
    d.sh('input keyevent KEYCODE_BACK'); await sleep(900);
  }

  if (want.includes('compact')) {
    note('== E/compact layout');
    await toBoard(); await goHome(); await clearIfAny();
    const tab = await d.find(/tab$/, { timeout: 2000 });
    const tabTop = tab ? tab.y1 : 2400;
    const rowsOf = async () => {
      const words = await d.find(/^(Say |Go to .* page$)/, { all: true, timeout: 2000 });
      const full = words.filter((n) => n.y1 >= 0 && n.y2 <= tabTop && !/^Go to home page$/.test(n.label));
      return new Set(full.map((n) => n.y1)).size;
    };
    const stdRows = await rowsOf();
    note(`standard layout: ${stdRows} full word rows above tab bar at y=${tabTop}`);
    d.screenshot('E1-standard');
    await openSettings();
    const on = await setSwitch('Compact layout', true);
    check('E2 compact layout switch on', on, `checked=${on}`);
    await scrollTop();
    d.sh('input keyevent KEYCODE_BACK'); await sleep(1200);
    const cRows = await rowsOf();
    d.screenshot('E2-compact');
    check('E2 compact shows more full rows', cRows > stdRows, `standard=${stdRows} compact=${cRows}`);
    const settingsBtn = await d.find('Settings', { timeout: 1500 }) || await d.find(/settings/i, { timeout: 500 });
    check('E2 Settings reachable from compact page row', !!settingsBtn, settingsBtn ? settingsBtn.label : 'missing');
    const ya = await gridTop();
    await tapW(/^Say I want\./); await tapW(/^Say help\./);
    const yb = await gridTop();
    for (const w2 of ['go', 'like', 'need', 'help', 'you', 'stop', 'go']) await tapW(new RegExp(`^Say ${w2}\\.`), { wait: 200 });
    const yc = await gridTop();
    await d.tap('Clear');
    const yd = await gridTop();
    check('E3 compact grid top stable', new Set([ya, yb, yc, yd]).size === 1, `y=${[ya, yb, yc, yd].join(',')}`);
    // touch target sizes (>= 48dp = 126px at 420dpi; checklist asks >= 44pt ~ 116px)
    const nodes = await d.dump('E2-compact');
    const tabC = nodes.find((n) => /tab$/.test(n.label));
    const fullyVisible = (n) => n.x1 > 0 && n.x2 < 1080 && n.y2 <= (tabC ? tabC.y1 : 2400) && !/tab$/.test(n.label);
    const small = nodes.filter((n) => n.clickable === 'true' && n.package.endsWith('prtest') && fullyVisible(n) && ((n.x2 - n.x1) < 115 || (n.y2 - n.y1) < 115));
    check('E2 compact tappable controls >= 44dp', small.length === 0, small.map((n) => `${n.label}:${n.x2 - n.x1}x${n.y2 - n.y1}`).join('; ') || 'none smaller');
    // restore standard layout
    await openSettings(); await setSwitch('Compact layout', false); await scrollTop();
    d.sh('input keyevent KEYCODE_BACK'); await sleep(1000);
  }

  if (want.includes('fonts')) {
    note('== E6/large system text');
    const prevScale = d.sh('settings get system font_scale').trim();
    d.sh('settings put system font_scale 2.0');
    await sleep(2500);
    await toBoard(); await goHome();
    d.screenshot('E6-font-scale-2.0-board');
    const nodes = await d.dump('E6-board');
    const tabF = nodes.find((n) => /tab$/.test(n.label));
    const btn = nodes.filter((n) => n.clickable === 'true' && n.package.endsWith('prtest') && n.x2 > n.x1 && (/tab$/.test(n.label) || n.y2 <= (tabF ? tabF.y1 : 2400)));
    const overlaps = [];
    for (let i = 0; i < btn.length; i++) for (let j = i + 1; j < btn.length; j++) {
      const a = btn[i], b = btn[j];
      const ix = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), iy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ix > 4 && iy > 4) overlaps.push(`${a.label.slice(0, 30)} x ${b.label.slice(0, 30)}`);
    }
    check('E6 no overlapping tappable controls at font scale 2.0 (board)', overlaps.length === 0, overlaps.slice(0, 6).join(' | ') || 'none');
    await openSettings();
    d.screenshot('E6-font-scale-2.0-settings');
    d.sh('input keyevent KEYCODE_BACK'); await sleep(800);
    d.sh(`settings put system font_scale ${prevScale === 'null' ? '1.0' : prevScale}`);
    await sleep(2000);
  }

  if (want.includes('speech')) {
    note('== B8/B9/B7 rapid speech and Stop (Clear)');
    await toBoard(); await goHome(); await clearIfAny();
    await openSettings(); await d.tap('Speech speed 1x', { wait: 600 });
    d.sh('input keyevent KEYCODE_BACK'); await sleep(900);
    const nodes = await d.dump();
    const pick = ['I want', 'I need', 'you', 'go', 'like', 'help'].map((w) => nodes.find((n) => n.label.startsWith(`Say ${w}.`)));
    d.logcatClear();
    const taps = pick.map((n) => `input tap ${n.cx} ${n.cy}`).join(' && ');
    const t0 = Date.now();
    d.sh(taps);
    const elapsed = Date.now() - t0;
    const samples = await samplePlayers(4000);
    let t = ttsLog();
    const s = await sentence();
    check('B8 six rapid taps all added', s === 'Sentence: I want I need you go like help', `${s} (taps took ${elapsed}ms)`);
    check('B8 never two TTS players at once', Math.max(...samples) <= 1, `max concurrent started players=${Math.max(...samples)}`);
    note(`B8 engine synthesis requests=${t.requests.length}, audio stops=${t.stops.length}`);
    fsWrite('B8-logcat.log', t.raw);

    d.logcatClear();
    const sp = await d.find(/^Speak sentence:/);
    d.sh(Array(5).fill(`input tap ${sp.cx} ${sp.cy}`).join(' && '));
    const samples2 = await samplePlayers(5000);
    t = ttsLog();
    check('B9 five rapid Speak taps never overlap', Math.max(...samples2) <= 1, `max concurrent=${Math.max(...samples2)}, requests=${t.requests.length}`);
    await sleep(3000);
    check('B12-ish speaking state settles (no player stuck)', startedTtsPlayers() === 0, `started now=${startedTtsPlayers()}`);
    fsWrite('B9-logcat.log', t.raw);

    // Clear while speaking stops audio
    d.logcatClear();
    await d.tap(/^Speak sentence:/, { wait: 500 });
    const before = startedTtsPlayers();
    await d.tap('Clear', { wait: 100 });
    const after = await samplePlayers(2500, 100);
    t = ttsLog();
    const firstSilent = after.findIndex((x) => x === 0);
    check('B7 Clear stops speech promptly and it does not restart', before >= 1 && firstSilent >= 0 && after.slice(firstSilent).every((x) => x === 0),
      `playing before Clear=${before}, samples after=${after.join('')}`);
    await d.tap('Undo last change to the sentence');
    const su = await sentence();
    check('B7 Undo restores message after Clear', su === 'Sentence: I want I need you go like help', su);
    await d.tap('Clear');
  }

  if (want.includes('longtext')) {
    note('== B6 long text (~5000 chars via pronunciation of "stop")');
    await toBoard();
    await openSettings();
    await typeInto('Word as written', 'stop');
    // ~5000 chars of numbered sentences (spaces encoded per 300-char chunk)
    let plain = '';
    for (let i = 1; plain.length < 5000; i++) plain += `Sentence ${i} is here to test long speech. `;
    await typeInto('How it should sound', '');
    const f = await scrollTo('How it should sound');
    await d.tap(f, { wait: 900 });
    for (let i = 0; i < plain.length; i += 300) d.sh(`input text "${plain.slice(i, i + 300).replace(/ /g, '%s')}"`);
    const typed = (await d.find('How it should sound')) || {};
    await hideKeyboard();
    note(`long text: intended ${plain.length} chars, field holds ${(typed.text || '').length}`);
    await d.tap(await scrollTo('Save pronunciation and hear it'), { wait: 800 });
    await sleep(500); // saving speaks the written word; let it start
    await scrollTop(); d.sh('input keyevent KEYCODE_BACK'); await sleep(900);
    await goHome(); await clearIfAny();
    d.logcatClear();
    await tapW(/^Say stop\./, { wait: 200 });
    const timeline = [];
    const end = Date.now() + 360000;
    let quiet = 0;
    while (Date.now() < end) {
      const p = startedTtsPlayers(); timeline.push(p);
      quiet = p ? 0 : quiet + 1;
      if (quiet >= 8 && timeline.some(Boolean)) break; // 8s of silence after audio
      await sleep(1000);
    }
    const t = ttsLog();
    fsWrite('B6-logcat.log', t.raw);
    const playedSecs = timeline.filter(Boolean).length;
    const gaps = timeline.slice(timeline.indexOf(1), timeline.lastIndexOf(1) + 1).filter((x) => !x).length;
    check('B6 long text sent to engine in more than one chunk', t.requests.length >= 2, `synthesis requests=${t.requests.length}`);
    check('B6 long text played without long silence between chunks', playedSecs > 60 && gaps <= 3, `played≈${playedSecs}s, silent samples inside playback=${gaps}`);
    // remove the long pronunciation entry
    await openSettings();
    const rm = await scrollTo(/^Remove pronunciation for stop/);
    if (rm) { await d.tap(rm, { wait: 700 }); const ok = await d.find(/^(Remove|OK|Delete)$/i, { timeout: 1000 }); if (ok) await d.tap(ok); }
    await scrollTop(); d.sh('input keyevent KEYCODE_BACK'); await sleep(800);
  }

  if (want.includes('ttserror')) {
    note('== B10 no TTS engine (emulator only: engine disabled, then re-enabled)');
    if (!process.env.ALLOW_TTS_DISABLE) { note('skipped: set ALLOW_TTS_DISABLE=1 (never on a personal phone)'); }
    else {
      await toBoard(); await goHome(); await clearIfAny();
      d.sh(`pm disable-user --user 0 ${TTS}`); _ttsPid = null;
      try {
        d.forceStop(); d.launch(); await sleep(5000);
        await tapW(/^Say I want\./, { wait: 300 });
        const t0 = Date.now();
        const notice = await d.find(/voice|speech/i, { timeout: 9000 }).then(async () => {
          const all = await d.find(/(no|couldn.t|could not).*(voice|speech)|(voice|speech).*(respond|install|unavailable)/i, { timeout: 9000 });
          return all;
        });
        d.screenshot('B10-no-tts-notice');
        check('B10 notice shown when no speech engine responds', !!notice, notice ? `${notice.label} (after ${Date.now() - t0}ms)` : 'no notice found');
        const s = await sentence();
        check('B10 message stays on screen', /I want/.test(s || ''), s);
        const resp = await tapW(/^Say help\./, { wait: 400 }).then(() => sentence());
        check('B10 app stays responsive', /I want help/.test(resp || ''), resp);
      } finally {
        d.sh(`pm enable ${TTS}`); _ttsPid = null;
      }
      await clearIfAny();
    }
  }

  if (want.includes('camera')) {
    note('== Camera: denial, grant, capture, gallery (test app permissions reset first)');
    const P = d.PKG;
    d.sh(`pm revoke ${P} android.permission.CAMERA`);
    resetCameraPerm(P); // revoking a runtime permission kills the app process
    d.forceStop(); d.launch(); await sleep(5000);
    await toBoard(); await goHome();
    const camBtn = await d.find('Open camera to describe what you see', { timeout: 2000 })
      || (await d.tap('More actions: favourites, history, show on screen, camera, voice style', { wait: 800 }), await d.find('Open camera to describe what you see'));
    await d.tap(camBtn, { wait: 2500 });
    let nodes = await d.dump('C1-camera-open');
    const storagePrompt = nodes.find((n) => /photos|media|files|storage/i.test(n.label) && /Allow/.test(n.label));
    const camPrompt = nodes.find((n) => /Allow .* to take pictures/.test(n.label));
    check('C0 no storage/media permission prompt when Camera opens', !storagePrompt, storagePrompt ? storagePrompt.label : 'none');
    check('C1 camera permission prompt shown', !!camPrompt, camPrompt ? camPrompt.label : 'no prompt');
    d.screenshot('C1-camera-prompt');
    await d.tap(/^(Don.t allow|Deny)$/, { wait: 1200 });
    await d.tap('Open camera', { wait: 1500 });
    const second = await d.find(/^(Don.t allow|Deny)$/, { timeout: 1500 });
    if (second) await d.tap(second, { wait: 1200 });
    const alert = await d.find('Camera permission needed', { timeout: 3000 });
    check('C2 denial explained in app (no crash)', !!alert, alert ? alert.label : 'no alert');
    d.screenshot('C2-camera-denied');
    if (alert) await d.tap(/^OK$/, { wait: 700 });

    // grant through the real system prompt
    resetCameraPerm(P);
    await d.tap('Open camera', { wait: 1800 });
    const allow = await d.find(/^(While using the app|Allow)$/, { timeout: 3000 });
    check('C3 prompt offered again after reset', !!allow, allow ? allow.label : 'no prompt');
    if (allow) await d.tap(allow, { wait: 3500 });
    const shutter = await d.find('Take photo', { timeout: 5000 });
    check('C3 camera preview opens after grant', !!shutter, shutter ? 'Take photo visible' : 'no preview');
    d.screenshot('C3-camera-preview');
    if (shutter) {
      d.logcatClear();
      await d.tap(shutter, { wait: 7000 });
      const lc = d.logcatSave('C4-capture-logcat');
      const got = /processDescribe start, has base64:', true/.test(lc);
      const readFail = /base64 read failed/.test(lc);
      check('C4 captured photo is read (base64) for processing', got && !readFail, got ? 'has base64: true' : (readFail ? 'base64 read failed' : 'no processing log'));
      const msg = await d.find(/Could not (describe|process)|Here is what|check your connection/, { timeout: 15000 });
      d.screenshot('C4-after-capture');
      check('C4 result message shown (offline build: connection message expected)', !!msg, msg ? msg.label : 'no message');
    }

    // gallery
    d.logcatClear();
    await d.tap('Pick from gallery', { wait: 3500 });
    nodes = await d.dump('C5-picker');
    d.screenshot('C5-picker');
    const storage2 = nodes.find((n) => /Allow/.test(n.label) && /photos|media|files|storage/i.test(n.label));
    check('C5 gallery opens without a storage permission prompt', !storage2, storage2 ? storage2.label : 'none');
    let item = nodes.find((n) => /^Photo taken on|voice-test-photo/.test(n.label) && n.clickable === 'true')
      || nodes.find((n) => /voice-test-photo|Photo taken on/.test(n.label));
    if (!item) {
      // DocumentsUI on older Android: open Images / Recent, then the file
      const images = nodes.find((n) => /^(Images|Recent)$/.test(n.label));
      if (images) { await d.tap(images, { wait: 2000 }); }
      item = await d.find(/voice-test-photo|Photo taken on/, { timeout: 4000 });
    }
    check('C5 test photo listed in picker', !!item, item ? item.label : 'not found');
    if (item) {
      await d.tap(item, { wait: 7000 });
      const lc = d.logcatSave('C6-gallery-logcat');
      const got = /processDescribe start, has base64:', true/.test(lc);
      check('C6 gallery photo is read (base64) for processing', got && !/base64 read failed/.test(lc), got ? 'has base64: true' : 'not read');
      const msg = await d.find(/Could not (describe|process)|Here is what|check your connection/, { timeout: 15000 });
      d.screenshot('C6-after-gallery');
      check('C6 result message shown', !!msg, msg ? msg.label : 'no message');
    }
    await toBoard();
  }

  if (want.includes('persist')) {
    note('== F/persistence after restart');
    await toBoard(); await openSettings();
    await d.tap('Speech speed 0.75x', { wait: 800 });
    d.sh('input keyevent KEYCODE_BACK'); await sleep(800);
    d.forceStop(); await sleep(800); d.launch(); await sleep(5000);
    await toBoard(); await goHome();
    await d.tap('Show favourites', { wait: 900 });
    const fav = await d.find(/^Speak favourite: I need help/, { timeout: 2000 });
    check('A4/F favourite survives restart', !!fav, fav ? fav.label : 'missing');
    const hide = await d.find('Hide favourites', { timeout: 800 }); if (hide) await d.tap(hide);
    await d.tap('Show sentence history', { wait: 900 });
    const rep = await d.find(/^Repeat: I need help/, { timeout: 2000 });
    check('F history survives restart', !!rep, rep ? rep.label : 'missing');
    const hh = await d.find('Hide sentence history', { timeout: 800 }); if (hh) await d.tap(hh);
    await openSettings();
    const sp = await d.find('Speech speed 0.75x');
    check('F speech speed 0.75x survives restart', sp && sp.selected === 'true', `selected=${sp && sp.selected}`);
    const entry = await scrollTo(/^help, said as help me please/);
    check('F1b pronunciation survives restart', !!entry, entry ? entry.label : 'missing');
    d.screenshot('F-persist-settings');
    await scrollTop(); d.sh('input keyevent KEYCODE_BACK'); await sleep(800);
    await goHome(); await clearIfAny();
    d.logcatClear();
    await tapW(/^Say help\./, { wait: 4000 });
    const t = ttsLog();
    check('F1b pronunciation still applied after restart (engine request)', t.requests.length >= 1, `requests=${t.requests.length}`);
    await clearIfAny();
  }

  const f = d.saveResults();
  note(`DONE: ${d.results.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})().catch((e) => { note(`ABORT: ${e.stack}`); d.screenshot('abort'); d.saveResults(); process.exit(2); });

function fsWrite(name, txt) { require('fs').writeFileSync(require('path').join(d.OUT, name), txt); }
// Make the camera prompt appear again, on this test package only.
function resetCameraPerm(P) {
  try { d.sh(`pm revoke ${P} android.permission.CAMERA`); } catch (_) { /* already revoked */ }
  try { d.sh(`pm clear-permission-flags ${P} android.permission.CAMERA user-set user-fixed`); return; } catch (_) { /* Android 11 */ }
  try { d.sh(`pm set-permission-flags ${P} android.permission.CAMERA 0`); return; } catch (_) { /* fall through */ }
  try { d.sh(`pm reset-permissions -p ${P}`); } catch (e) { note(`could not reset camera permission flags: ${e.message.split('\n')[0]}`); }
}
