// Very long messages: the full-screen display renders without crashing and
// keeps the whole message (on-screen fit itself needs a device), and speech
// chunking loses no words. Artificial text only.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { theme: 'light', boardLayout: 'classic' } }),
}));

const DisplayMode = require('../components/DisplayMode').default;
const { chunkText } = require('../services/speechService');

const words = (n) => Array.from({ length: n }, (_, i) => `zib${i}${i % 9 === 8 ? '.' : ''}`).join(' ');

test('DisplayMode renders a 3000-character message without crashing and keeps all of it', () => {
  const text = words(450);
  expect(text.length).toBeGreaterThan(3000);
  let tree;
  act(() => { tree = TestRenderer.create(<DisplayMode visible text={text} onClose={() => {}} />); });
  const shown = tree.root.findAll((n) => n.props && n.props.accessibilityRole === 'text' && n.props.children === text);
  expect(shown.length).toBeGreaterThan(0);
  expect(shown[0].props.adjustsFontSizeToFit).toBe(true);
  act(() => tree.unmount());
});

test('chunking a 12000-character message keeps every word in order within the limit', () => {
  const text = words(1600);
  const chunks = chunkText(text, 4000);
  expect(chunks.length).toBeGreaterThanOrEqual(3);
  chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(4000));
  expect(chunks.join(' ').split(/\s+/)).toEqual(text.split(/\s+/));
});
