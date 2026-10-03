/* eslint-env jest */
// Regression (native Android, emulator): scroll Home, open People, come back.
// The first row sat 14px higher (y 1393 -> 1379) because the grid kept its
// scroll offset across pages. The board now resets the grid on page change.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useScrollToTopOnChange } from '../hooks/useScrollToTopOnChange';

function Probe({ listRef, pageId }) {
  useScrollToTopOnChange(listRef, pageId);
  return null;
}

describe('useScrollToTopOnChange', () => {
  let listRef;
  beforeEach(() => {
    listRef = { current: { scrollToOffset: jest.fn() } };
  });

  test('does not scroll on first render', () => {
    act(() => { TestRenderer.create(<Probe listRef={listRef} pageId="home" />); });
    expect(listRef.current.scrollToOffset).not.toHaveBeenCalled();
  });

  test('scrolls to the top, without animation, each time the page changes', () => {
    let r;
    act(() => { r = TestRenderer.create(<Probe listRef={listRef} pageId="home" />); });
    act(() => { r.update(<Probe listRef={listRef} pageId="people" />); });
    act(() => { r.update(<Probe listRef={listRef} pageId="home" />); });
    expect(listRef.current.scrollToOffset).toHaveBeenCalledTimes(2);
    expect(listRef.current.scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  });

  test('does not scroll when the page stays the same (typing, suggestions, scanning)', () => {
    let r;
    act(() => { r = TestRenderer.create(<Probe listRef={listRef} pageId="home" />); });
    act(() => { r.update(<Probe listRef={listRef} pageId="home" />); });
    expect(listRef.current.scrollToOffset).not.toHaveBeenCalled();
  });

  test('is safe before the list has mounted', () => {
    const empty = { current: null };
    let r;
    act(() => { r = TestRenderer.create(<Probe listRef={empty} pageId="home" />); });
    expect(() => act(() => { r.update(<Probe listRef={empty} pageId="food" />); })).not.toThrow();
  });
});
