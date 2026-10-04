/* eslint-env jest */
import React from 'react';
import { Image, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { VisualMessage, VisualListRow, VisualSuggestionChip } from '../components/studio/VisualMessage';

let mockStyle = 'mixed';
jest.mock('../contexts/SettingsContext', () => ({ useSettings: () => ({ settings: { symbolStyle: mockStyle } }) }));
jest.mock('../design/usePaper', () => ({ usePaper: () => ({ c: { ink: '#000', inkSoft: '#333', card: '#fff', line: '#888', focus: '#009', lineStrong: '#444' }, scale: 1 }) }));
jest.mock('../services/customVocabStore', () => ({ getCustomButtons: () => [{ id: 'personal', label: 'my cup', imageUri: 'file:///cup.jpg' }] }));
jest.mock('../services/symbolStore', () => ({ symbolSourceFor: (button) => button?.imageUri ? { uri: button.imageUri } : null }));

function render(node) { let renderer; act(() => { renderer = TestRenderer.create(node); }); return renderer; }
afterEach(() => { mockStyle = 'mixed'; });

test('picture-only decoration does not duplicate screen-reader words', () => {
  const r = render(<VisualMessage text="my cup please" />);
  expect(r.root.findByType(Image).props.source.uri).toBe('file:///cup.jpg');
  expect(r.root.findAll((node) => node.props.importantForAccessibility === 'no-hide-descendants').length).toBeGreaterThan(0);
  act(() => r.unmount());
});
test('failed personal image retains its complete word label', () => {
  const r = render(<VisualMessage text="my cup" />);
  act(() => r.root.findByType(Image).props.onError());
  expect(r.root.findAllByType(Image)).toHaveLength(0);
  expect(r.root.findAllByType(Text).some((node) => JSON.stringify(node.props.children).includes('my cup'))).toBe(true);
  act(() => r.unmount());
});
test('explicit text mode removes decorative images but retains the actionable message', () => {
  mockStyle = 'text';
  const onPress = jest.fn();
  const r = render(<VisualListRow text="my cup" onPress={onPress} />);
  expect(r.root.findAllByType(Image)).toHaveLength(0);
  const button = r.root.find((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  expect(button.props.accessibilityLabel).toBe('my cup');
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => r.unmount());
});
test('suggestion never acts automatically and exposes its full text', () => {
  const onPress = jest.fn();
  const r = render(<VisualSuggestionChip word="my cup" reason="Personal" onPress={onPress} />);
  expect(onPress).not.toHaveBeenCalled();
  const button = r.root.find((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  expect(button.props.accessibilityLabel).toBe('Suggestion: my cup. Personal');
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => r.unmount());
});
