// The open-source notices shown in the app must cover every shipped package
// with readable licence text, and flag nothing copyleft / non-commercial.
const notices = require('../data/thirdPartyNotices.json');
const pkg = require('../../package.json');

describe('third-party notices', () => {
  test('every direct runtime dependency is listed', () => {
    const listed = new Set(notices.packages.map(p => p.name));
    Object.keys(pkg.dependencies).forEach(dep => expect(listed.has(dep)).toBe(true));
  });

  test('every package has licence text available to show', () => {
    notices.packages.forEach(p => {
      const own = p.textId && notices.texts[p.textId];
      const standard = p.license.split(/\s+(?:AND|OR)\s+/)
        .every(id => notices.standardTexts[id.replace(/[()]/g, '')]);
      expect({ name: p.name, ok: Boolean(own || standard) }).toEqual({ name: p.name, ok: true });
    });
  });

  test('no copyleft, non-commercial or unknown licences ship in the app', () => {
    const bad = notices.packages.filter(p => /GPL|SSPL|-NC|UNKNOWN|UNLICENSED/i.test(p.license));
    expect(bad).toEqual([]);
  });

  test('Apache-2.0 full text is bundled (Apache-2.0 section 4(a))', () => {
    expect(notices.standardTexts['Apache-2.0']).toMatch(/Apache License\s+Version 2\.0/);
  });
});
