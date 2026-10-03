// A sheet takes over switch scanning only if the board was scanning, lets
// the switch select items inside the sheet, and hands scanning back intact.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as scan from '../services/switchScanService';
import { useOverlayScan } from '../hooks/useOverlayScan';

function Probe({ active, items, onFocus }) {
  onFocus(useOverlayScan(active, items));
  return null;
}

beforeEach(() => { jest.useFakeTimers(); scan.stopScan(); });
afterEach(() => { scan.cleanup(); jest.useRealTimers(); });

test('takes over while open, selects sheet items, then restores the board', () => {
  const boardSelect = jest.fn();
  scan.setScanItems([{ id: 'w1' }, { id: 'w2' }]);
  scan.onScanSelect(({ item }) => boardSelect(item.id));
  scan.setScanMode('step');
  scan.startScan();

  const sheetPick = jest.fn();
  let focus = null;
  const items = [{ id: 'a', onSelect: () => sheetPick('a') }, { id: 'b', onSelect: () => sheetPick('b') }];
  let r;
  act(() => { r = TestRenderer.create(<Probe active items={items} onFocus={(f) => { focus = f; }} />); });

  expect(focus).toBe('a'); // scanning starts on the sheet's first item
  act(() => { scan.advanceScan(); });
  expect(focus).toBe('b');
  act(() => { scan.selectCurrent(); });
  expect(sheetPick).toHaveBeenCalledWith('b');
  expect(boardSelect).not.toHaveBeenCalled();

  act(() => { r.update(<Probe active={false} items={items} onFocus={(f) => { focus = f; }} />); });
  expect(scan.getScanState().isRunning).toBe(true);
  act(() => { scan.selectCurrent(); });
  expect(boardSelect).toHaveBeenCalledWith('w1'); // back on the board's own items
});

test('does nothing when the board was not scanning', () => {
  let focus = 'x';
  act(() => { TestRenderer.create(<Probe active items={[{ id: 'a', onSelect: jest.fn() }]} onFocus={(f) => { focus = f; }} />); });
  expect(scan.getScanState().isRunning).toBe(false);
  expect(focus).toBeNull();
});
