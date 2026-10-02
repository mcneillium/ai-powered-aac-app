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

describe('notice completeness', () => {
  test('packages without their own LICENSE file carry a copyright line', () => {
    notices.packages.filter(p => !p.textId).forEach(p => {
      expect({ name: p.name, copyright: /^Copyright/.test(p.copyright || '') }).toEqual({ name: p.name, copyright: true });
    });
  });

  test('bundled icon fonts are listed with notice and licence text', () => {
    const names = notices.fonts.map(f => f.name).join(' ');
    expect(names).toMatch(/Ionicons/);
    expect(names).toMatch(/Material Icons/);
    notices.fonts.forEach(f => {
      expect(f.copyright).toMatch(/^Copyright/);
      expect(notices.standardTexts[f.license]).toBeTruthy();
    });
  });

  test('nested package copies are listed at the version actually bundled', () => {
    const webidl = notices.packages.filter(p => p.name === 'webidl-conversions');
    expect(webidl.map(p => p.version)).toEqual(['5.0.0']);
  });
});

