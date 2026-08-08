/**
 * Scan-cursor identity.
 *
 * The bug these pin: suggestion scan items were keyed by array position
 * (`sug-0`, `sug-1`, …), so a fresh batch of predictions with the same *count*
 * compared equal to the previous batch. The highlight stayed put while the word
 * underneath it changed, and an auto-scan user — whose motor latency is the
 * reason they use auto-scan — pressed their switch on the word they could see
 * and the device spoke a different one.
 *
 * The second bug: on a genuine list change the cursor was reset to -1 with no
 * change event emitted, so the on-screen highlight reported a stale position
 * and any press in that window was silently swallowed.
 */

import {
  setScanItems,
  onScanChange,
  startScan,
  stopScan,
  advanceScan,
  getScanState,
} from '../services/switchScanService';

const item = (id, label) => ({ id, label });

afterEach(() => {
  stopScan();
  onScanChange(null);
  setScanItems([]);
});

describe('setScanItems identity', () => {
  test('keeps the cursor when nothing material changed', () => {
    setScanItems([item('a', 'yes'), item('b', 'no')]);
    startScan();
    advanceScan();
    const before = getScanState().currentIndex;

    setScanItems([item('a', 'yes'), item('b', 'no')]);
    expect(getScanState().currentIndex).toBe(before);
  });

  test('does NOT keep the cursor when the words change under the same ids', () => {
    // The exact shape of the old failure: same count, same positional ids,
    // completely different words.
    setScanItems([item('sug-yes', 'yes'), item('sug-no', 'no')]);
    startScan();
    advanceScan(); // now on 'no'

    setScanItems([item('sug-toilet', 'toilet'), item('sug-drink', 'drink')]);

    const { currentIndex } = getScanState();
    // Either the cursor is cleared, or it followed a surviving item. It must
    // never still be pointing at index 1 as if nothing happened.
    if (currentIndex >= 0) {
      throw new Error(`cursor stayed at ${currentIndex} across a full content swap`);
    }
    expect(currentIndex).toBe(-1);
  });

  test('follows an item to its new position instead of resetting to 0', () => {
    setScanItems([item('a', 'yes'), item('b', 'no'), item('c', 'help')]);
    startScan();
    advanceScan();
    advanceScan(); // on 'help', index 2

    // A prediction resolves and prepends an item. 'help' is still there.
    setScanItems([item('z', 'more'), item('a', 'yes'), item('b', 'no'), item('c', 'help')]);

    expect(getScanState().currentIndex).toBe(3);
  });

  test('emits a change event when the cursor moves because the list changed', () => {
    const seen = [];
    setScanItems([item('a', 'yes'), item('b', 'no')]);
    startScan();
    onScanChange((state) => seen.push(state.currentIndex));

    setScanItems([item('x', 'toilet')]);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(getScanState().currentIndex);
  });

  test('tolerates a non-array argument without throwing', () => {
    setScanItems([item('a', 'yes')]);
    expect(() => setScanItems(undefined)).not.toThrow();
    expect(getScanState().itemCount).toBe(0);
  });
});
