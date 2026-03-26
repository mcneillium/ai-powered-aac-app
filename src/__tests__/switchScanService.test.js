// Tests for switch scanning service
import {
  setScanItems, setScanMode, setScanSpeed, getScanState,
  onScanChange, onScanSelect, startScan, stopScan,
  advanceScan, selectCurrent, handleScanKeyEvent, cleanup,
} from '../services/switchScanService';

beforeEach(() => {
  cleanup();
});

describe('switchScanService', () => {
  test('starts with no items and not running', () => {
    const state = getScanState();
    expect(state.isRunning).toBe(false);
    expect(state.currentIndex).toBe(-1);
    expect(state.itemCount).toBe(0);
  });

  test('setScanItems updates item count', () => {
    setScanItems(['a', 'b', 'c']);
    expect(getScanState().itemCount).toBe(3);
  });

  test('startScan begins at index 0', () => {
    setScanItems(['a', 'b', 'c']);
    startScan();
    const state = getScanState();
    expect(state.isRunning).toBe(true);
    expect(state.currentIndex).toBe(0);
  });

  test('advanceScan moves to next item and wraps', () => {
    setScanItems(['a', 'b', 'c']);
    setScanMode('step');
    startScan();
    expect(getScanState().currentIndex).toBe(0);
    advanceScan();
    expect(getScanState().currentIndex).toBe(1);
    advanceScan();
    expect(getScanState().currentIndex).toBe(2);
    advanceScan();
    expect(getScanState().currentIndex).toBe(0); // wraps
  });

  test('selectCurrent emits correct item', () => {
    const items = ['apple', 'banana', 'cherry'];
    setScanItems(items);
    setScanMode('step');
    startScan();
    advanceScan(); // now at index 1

    let selected = null;
    onScanSelect(({ item }) => { selected = item; });
    selectCurrent();
    expect(selected).toBe('banana');
  });

  test('stopScan resets state', () => {
    setScanItems(['a', 'b']);
    startScan();
    stopScan();
    expect(getScanState().isRunning).toBe(false);
    expect(getScanState().currentIndex).toBe(-1);
  });

  test('onScanChange callback fires on start', () => {
    let changeData = null;
    onScanChange((data) => { changeData = data; });
    setScanItems(['a']);
    startScan();
    expect(changeData).not.toBeNull();
    expect(changeData.currentIndex).toBe(0);
    expect(changeData.isRunning).toBe(true);
  });

  test('setScanSpeed clamps to valid range', () => {
    setScanSpeed(100); // too low
    expect(getScanState().scanSpeed).toBe(500);
    setScanSpeed(10000); // too high
    expect(getScanState().scanSpeed).toBe(5000);
    setScanSpeed(2000); // valid
    expect(getScanState().scanSpeed).toBe(2000);
  });

  test('handleScanKeyEvent returns false when not running', () => {
    const result = handleScanKeyEvent({ nativeEvent: { key: ' ' } });
    expect(result).toBe(false);
  });

  test('handleScanKeyEvent selects in auto mode on space', () => {
    setScanItems(['x', 'y']);
    setScanMode('auto');
    startScan();

    let selected = null;
    onScanSelect(({ item }) => { selected = item; });
    const handled = handleScanKeyEvent({ nativeEvent: { key: ' ' } });
    expect(handled).toBe(true);
    expect(selected).toBe('x');
  });

  test('does not start with empty items', () => {
    setScanItems([]);
    startScan();
    expect(getScanState().isRunning).toBe(false);
  });
});
