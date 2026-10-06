/* eslint-env jest */
import { PORTABLE_FORMAT, parsePortableBoard, previewPortableImport, printableBoardHTML, safePhoto, MAX_FILE_BYTES } from '../services/portable-board-format';
const file = (personalWords) => JSON.stringify({ format: PORTABLE_FORMAT, version: 1, personalWords });

test('imports only recognised fields, never foreign paths or core changes', () => {
  const parsed = parsePortableBoard(JSON.stringify({ format: PORTABLE_FORMAT, version: 1, corePages: [{ label: 'evil' }], personalWords: [{ word: 'my cup', category: 'noun', id: 'existing', imageUri: 'file:///secrets' }] }));
  expect(parsed.personalWords).toEqual([{ word: 'my cup', category: 'noun', photo: null }]);
  expect(parsed.corePages).toBeUndefined();
});
test('preview skips case-insensitive duplicates including core and repeated file labels', () => {
  const parsed = parsePortableBoard(file([{ word: 'WATER', category: 'noun' }, { word: 'Paul', category: 'noun' }, { word: 'Music', category: 'noun' }, { word: 'music', category: 'noun' }]));
  const preview = previewPortableImport(parsed, [{ word: 'paul' }], ['water']);
  expect(preview.add.map((item) => item.word)).toEqual(['Music']);
  expect(preview.skipped).toHaveLength(3);
});
test('rejects unsupported format, excessive items, long labels and malformed photos', () => {
  expect(() => parsePortableBoard('{}')).toThrow();
  expect(() => parsePortableBoard(file(Array(251).fill({ word: 'cup', category: 'noun' })))).toThrow();
  expect(() => parsePortableBoard(file([{ word: 'x'.repeat(121), category: 'noun' }]))).toThrow();
  expect(() => parsePortableBoard(file([{ word: 'cup', category: 'unknown' }]))).toThrow();
  expect(() => parsePortableBoard(' '.repeat(MAX_FILE_BYTES + 1))).toThrow();
  expect(() => safePhoto({ mime: 'image/svg+xml', base64: 'PHN2Zz4=' })).toThrow();
  expect(() => safePhoto({ mime: 'image/jpeg', base64: 'https://example.com' })).toThrow();
});
test('accepts bounded PNG/JPEG data without URLs', () => {
  expect(safePhoto({ mime: 'image/jpeg', base64: '/9j/AAAA' }).base64).toBe('/9j/AAAA');
  expect(safePhoto({ mime: 'image/png', base64: 'iVBORw0KGgo=' }).mime).toBe('image/png');
});
test('printable board escapes injection, preserves words and bounds columns', () => {
  const html = printableBoardHTML({ columns: 999, corePages: [{ label: '<script>bad</script>', buttons: [{ label: '<img src=x onerror=bad>', emoji: '🥤' }] }], personalWords: [{ word: 'my cup', category: 'noun', photo: { mime: 'image/jpeg', base64: '/9j/AAAA' } }] });
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img src=x');
  expect(html).toContain('&lt;img src=x onerror=bad&gt;');
  expect(html).toContain('repeat(6,1fr)');
  expect(html).toContain('data:image/jpeg;base64,/9j/AAAA');
  expect(html).toContain('my cup');
});
