/**
 * Static structural checks on database.rules.json.
 *
 * These cannot verify *behaviour* — that needs the emulator, and lives in
 * test/rules/database.rules.test.js. What they can do is run everywhere, in
 * under a second, with no Java, and catch the two mistakes that have actually
 * happened on this project:
 *
 *   1. A path the code reads or writes that has no rule at all, and therefore
 *      silently falls through to the deny-all catch-all. `sessions` and
 *      `fineTuneMetrics` are both in schema.js and both unruled.
 *   2. A rule accidentally left world-open during debugging.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;

/** Top-level nodes that have an explicit rule block. */
const ruledNodes = Object.keys(rules).filter((k) => !k.startsWith('.') && k !== '$other');

/**
 * Every top-level RTDB path the app source actually touches, harvested from the
 * source rather than from schema.js — schema.js is documentation and has drifted
 * from reality before.
 */
function harvestPathsFromSource() {
  const dirs = [path.join(ROOT, 'src'), path.join(ROOT, 'functions')];
  const found = new Set();
  const skip = new Set(['node_modules', '__tests__', 'mocks']);

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skip.has(e.name)) walk(path.join(dir, e.name));
      } else if (/\.jsx?$/.test(e.name)) {
        const src = fs.readFileSync(path.join(dir, e.name), 'utf8');
        // ref(db, 'users/...'), ref(db, `users/${uid}`), db.ref('users/...')
        for (const m of src.matchAll(/\bref\s*\(\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?['"`]\/?([A-Za-z][\w-]*)[/'"`]/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  dirs.forEach(walk);
  return found;
}

describe('database.rules.json structure', () => {
  test('has a deny-all catch-all at the root', () => {
    expect(rules.$other).toBeDefined();
    expect(rules.$other['.read']).toBe(false);
    expect(rules.$other['.write']).toBe(false);
  });

  test('no rule anywhere is world-open', () => {
    const offenders = [];
    const walk = (node, at) => {
      if (node === null || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        const here = `${at}/${key}`;
        if (key === '.read' || key === '.write') {
          if (value === true || value === 'true') offenders.push(here);
        } else {
          walk(value, here);
        }
      }
    };
    walk(rules, '');
    expect(offenders).toEqual([]);
  });

  test('every owned node gates on auth.uid matching the path segment', () => {
    const ungated = [];
    for (const node of ruledNodes) {
      const perUid = rules[node]?.$uid;
      if (!perUid) continue;
      for (const op of ['.read', '.write']) {
        const rule = perUid[op];
        if (rule === false) continue; // an explicit deny is fine
        if (typeof rule !== 'string' || !/auth\s*!=\s*null/.test(rule) || !/auth\.uid\s*===?\s*\$uid/.test(rule)) {
          ungated.push(`${node}/$uid${op}`);
        }
      }
    }
    expect(ungated).toEqual([]);
  });

  test('userLogs and feedback reject unknown fields', () => {
    expect(rules.userLogs.$uid.$logId.$other['.validate']).toBe(false);
    expect(rules.userLogs.$uid.$logId.deviceInfo.$other['.validate']).toBe(false);
    expect(rules.feedback.$uid.$entryId.$other['.validate']).toBe(false);
  });

  test('userLogs requires action and timestamp', () => {
    expect(rules.userLogs.$uid.$logId['.validate']).toMatch(/hasChildren\(\['action', 'timestamp'\]\)/);
  });
});

describe('rules coverage against paths the code actually uses', () => {
  const used = harvestPathsFromSource();

  test('the harvester found something (guards against a silently broken regex)', () => {
    expect(used.size).toBeGreaterThan(3);
  });

  test('every RTDB path used in src/ or functions/ has a governing rule', () => {
    const unruled = [...used].filter((p) => !ruledNodes.includes(p)).sort();
    // A path with no rule is not "insecure" — the catch-all denies it — but it
    // IS broken: the feature that reads it silently returns nothing forever.
    expect(unruled).toEqual([]);
  });
});
